import type { EventMap, EventPayload } from '~~/types'
import { setTimeout } from '~/workers/utils/constants'
import { CloseMap, WebSocketCloseCode, WebSocketMessageType } from '~/workers/utils/web-socket-manager/constants'
import { DataFramePreparator } from '~/workers/utils/web-socket-manager/data-frame-preparator'
import { Emitter } from '~/workers/utils/web-socket-manager/emitter'
import { WebSocketManagerError } from '~/workers/utils/web-socket-manager/errors/web-socket-manager.error'
import { PayloadHandler } from '~/workers/utils/web-socket-manager/handler.payload'
import { HeartbeatManager } from '~/workers/utils/web-socket-manager/manager.heartbeat'
import { ReconnectManager } from '~/workers/utils/web-socket-manager/manager.reconnect'
import { MessageQueue } from '~/workers/utils/web-socket-manager/message-queue'
import type { Data, LoggerContract } from '~/workers/utils/web-socket-manager/types'

interface WebSocketManagerOptions {
  url: string | URL
  protocols?: string | string[]
  logger?: LoggerContract
  /**
   * @default 5
   */
  maxReconnectAttempts?: number
  /**
   * @default 30_000
   */
  reconnectInterval?: number
  /**
   * @default 30_000
   */
  pingInterval?: number
  /**
   * @default 10_000
   */
  pingTimeout?: number
}

export class WebSocketManager<ReceiveEvents extends EventMap, SendEvents extends EventMap> {
  static readonly #constructorSymbol: symbol = Symbol('WebSocketManager')
  static readonly #closeFrame: Uint8Array = new Uint8Array([0x88, 0x00])
  static readonly #pingFrame: Uint8Array = new Uint8Array([0x89, 0x00])
  static readonly #pongFrame: Uint8Array = new Uint8Array([0x8A, 0x00])
  static readonly #maxChunkSize: number = 0x100000 // 1MB

  // async *[Symbol.asyncIterator]() {}

  static connect<
    ReceiveEvents extends EventMap,
    SendEvents extends EventMap,
  >(options: WebSocketManagerOptions,
  ): Promise<WebSocketManager<ReceiveEvents, SendEvents>> {
    const instance = new WebSocketManager<ReceiveEvents, SendEvents>(this.#constructorSymbol, options)
    return instance.#connect()
  }

  #url: string | URL
  #protocols?: string | string[]
  #webSocket: WebSocket | null = null
  #logger?: LoggerContract
  #messageQueue: MessageQueue<SendEvents> = new MessageQueue()
  #emitter: Emitter<ReceiveEvents> = new Emitter()
  #dataFramePreparator: DataFramePreparator = new DataFramePreparator()
  #heartbeatManager: HeartbeatManager
  #reconnectManager: ReconnectManager = new ReconnectManager({
    maxReconnectAttempts: 5,
    reconnectInterval: 30_000,
  })

  #payloadHandler: PayloadHandler<EventPayload<ReceiveEvents>> = new PayloadHandler(this.#logger)

  get isConnected(): boolean {
    return this.#webSocket?.readyState === WebSocket.OPEN
  }

  private constructor(constructorSymbol: symbol, options: WebSocketManagerOptions) {
    if (constructorSymbol !== WebSocketManager.#constructorSymbol) {
      throw new WebSocketManagerError('WebSocketManager cannot be instantiated directly')
    }

    this.#url = options.url
    this.#protocols = options.protocols
    this.#logger = options.logger

    this.#heartbeatManager = new HeartbeatManager({
      pingInterval: options.pingInterval ?? 30_000,
      pingTimeout: options.pingTimeout ?? 60_000,
      onPing: this.#ping.bind(this),
      onPingTimeout: () => {
        this.#logger?.warn('No pong received, connection might be lost')
        this.close(...CloseMap.PingTimeout)
      },
    })
  }

  destroy(code?: number, reason?: string): void {
    this.#stopHeartbeat()
    this.#sendClose()
    this.#webSocket?.close(code, reason)
    this.#webSocket = null
  }

  /**
   * @see {@link https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1|Defined Status Codes}
   * @throws If the close code is invalid
   */
  close(code?: number, reason?: string): void {
    if (code && (code < WebSocketCloseCode.Min || code > WebSocketCloseCode.Max)) {
      throw new WebSocketManagerError('Close code must be between 3000 and 3999')
    }

    this.destroy(code, reason)
  }

  // eslint-disable-next-line complexity
  send(data: Data<SendEvents>, opcode?: number): void {
    if (!this.isConnected) {
      this.#enqueueMessage(data, opcode)
      return
    }

    try {
      if (data instanceof Uint8Array) {
        this.#chunkAndSend(data, opcode ?? WebSocketMessageType.OPCODE_BINARY)
        return
      }

      const isText = typeof data === 'string' || (typeof data === 'object' && !(data instanceof ArrayBuffer))

      if (isText) {
        this.#webSocket?.send(this.#prepareFrame(data, WebSocketMessageType.OPCODE_TEXT))
        return
      }

      this.#logger?.log('Sending message:', data)
    }
    catch (error) {
      this.#logger?.error('Failed to send message:', error)
      this.#enqueueMessage(data, opcode)
    }
  }

  on<T extends keyof ReceiveEvents>(event: T, callback: (data: ReceiveEvents[T]) => void): void {
    this.#emitter.on(event, callback)
  }

  off<T extends keyof ReceiveEvents>(event: T, callback: (data: ReceiveEvents[T]) => void): void {
    this.#emitter.off(event, callback)
  }

  /**
   * @example
   * const largeData = new Uint8Array(100 * 1024 * 1024) // 100MB of data
   */
  #chunkAndSend(data: Uint8Array, opcode: WebSocketMessageType.OPCODE_BINARY | WebSocketMessageType.OPCODE_TEXT): void {
    const maxChunkSize = WebSocketManager.#maxChunkSize
    const totalChunks = Math.ceil(data.length / maxChunkSize)

    const sendChunk = (chunkIndex: number): void => {
      if (chunkIndex >= totalChunks) {
        return
      }

      const start = chunkIndex * maxChunkSize
      const end = Math.min((chunkIndex + 1) * maxChunkSize, data.length)
      const chunk = data.subarray(start, end)

      try {
        this.#webSocket?.send(this.#prepareFrame(chunk, opcode))

        setTimeout(() => sendChunk(chunkIndex + 1), 0)
      }
      catch (error) {
        this.#logger?.error('Failed to send chunk:', error)
      }
    }

    sendChunk(0)
  }

  #prepareFrame(data: Data<SendEvents>, opcode?: number): Uint8Array {
    opcode ??= data instanceof Uint8Array || data instanceof ArrayBuffer
      ? WebSocketMessageType.OPCODE_BINARY
      : WebSocketMessageType.OPCODE_TEXT

    return this.#createFrame(data, opcode)
  }

  #emit<T extends keyof ReceiveEvents>(event: T, data: ReceiveEvents[T]): void {
    this.#emitter.emit(event, data)
  }

  #sendClose(): void {
    this.send(WebSocketManager.#closeFrame, WebSocketMessageType.OPCODE_CONNECTION_CLOSE)
  }

  #ping(): void {
    this.send(WebSocketManager.#pingFrame, WebSocketMessageType.OPCODE_PING)
  }

  #pong(): void {
    this.send(WebSocketManager.#pongFrame, WebSocketMessageType.OPCODE_PONG)
  }

  async #connect(): Promise<this> {
    const { promise, reject, resolve } = Promise.withResolvers<this>()

    this.#webSocket = new WebSocket(this.#url, this.#protocols)
    this.#webSocket.binaryType = 'arraybuffer'

    const on = this.#webSocket.addEventListener.bind(this.#webSocket)

    on('error', (event) => {
      this.#logger?.error('WebSocket error:', event)

      if (this.#shouldReconnect(event)) {
        this.#reconnect()
      }
      else {
        reject(event)
      }
    })

    on('close', (event) => {
      this.#logger?.warn('WebSocket connection closed:', event)
      this.#stopHeartbeat()
      this.#reconnect()
    }, { once: true })

    on('open', (event) => {
      this.#logger?.log('WebSocket connection opened:', event.timeStamp)
      this.#startHeartbeat()
      this.#sendQueuedMessages()
      resolve(this)
    }, { once: true })

    on('message', this.#handleMessage.bind(this))

    return promise
  }

  #shouldReconnect(_event: Event): boolean {
    return true
  }

  #handleMessage(event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      this.#handleArrayBufferMessage(event.data)
    }
    else {
      this.#logger?.warn('Unexpected message format', event.data)
    }
  }

  // eslint-disable-next-line complexity
  #handleArrayBufferMessage(value: ArrayBuffer): void {
    const data = new Uint8Array(value)

    if (data.length === 0) {
      return
    }

    const opcode = this.#getOpcodeFromData(data)

    if (opcode === WebSocketMessageType.OPCODE_PING) {
      this.#pong()
      return
    }

    if (opcode === WebSocketMessageType.OPCODE_PONG) {
      this.#heartbeatManager.updateLastPongTime()
      return
    }

    const payload = this.#payloadHandler.handlePayload(opcode, data.slice(1))

    if (!payload) {
      this.#logger?.warn('Invalid payload:', data)
      return
    }

    this.#emit(payload.type, (payload as any).data)
  }

  #getOpcodeFromData(data: Uint8Array): number {
    const firstByte = data[0]

    if (!firstByte) {
      throw new WebSocketManagerError('Invalid data')
    }

    return firstByte & WebSocketMessageType.OPCODE_MASK
  }

  #reconnect(): void {
    if (this.isConnected)
      return

    // this.#reconnectManager.resetAttempts()
    this.#reconnectManager.run(() => {
      this.#connect().catch((error) => {
        this.#logger?.error('Failed to reconnect:', error)
      })
    })
  }

  #enqueueMessage(data: Data<SendEvents>, opcode?: number): void {
    this.#messageQueue.enqueue(data, opcode)
    this.#logger?.warn('WebSocket is not open, message queued.')
  }

  #sendQueuedMessages(): void {
    while (!this.#messageQueue.isEmpty) {
      const message = this.#messageQueue.dequeue()
      if (message) {
        this.send(message.data, message.opcode)
      }
    }
  }

  #startHeartbeat(): void {
    this.#heartbeatManager.start()
  }

  #stopHeartbeat(): void {
    this.#heartbeatManager.stop()
  }

  #createFrame(data: Uint8Array | string | object, opcode: number): Uint8Array {
    return this.#dataFramePreparator.createFrame(data, opcode)
  }
}

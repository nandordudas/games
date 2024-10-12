import type { EventMap, EventPayload } from '~~/types'

import { type ConsolaInstance, createConsola } from 'consola'

const setInterval = globalThis.setInterval.bind(globalThis)
const clearInterval = globalThis.clearInterval.bind(globalThis)
const setTimeout = globalThis.setTimeout.bind(globalThis)

class WebSocketManagerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebSocketManagerError'
  }
}

// [TODO] Check option exposing
interface WebSocketManagerOptions {
  // maxReconnectAttempts?: number
  // reconnectInterval?: number
  // pingInterval?: number
  // pingTimeout?: number
  logger: ConsolaInstance
}

/**
 * @see https://www.rfc-editor.org/rfc/rfc6455.html#section-5.2
 * @see https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
 */
export class WebSocketManager<ReceiveEvents extends EventMap> {
  static readonly #CONSTRUCTOR_SYMBOL = Symbol('WebSocketManager')
  //
  static readonly #OPCODE_TEXT = 0x01
  static readonly #OPCODE_BINARY = 0x02
  static readonly #OPCODE_PING = 0x09
  static readonly #OPCODE_CONNECTION_CLOSE = 0x08
  static readonly #OPCODE_PONG = 0x0A
  //
  static readonly #PING_FRAME = new Uint8Array([0x89, 0x00])
  static readonly #PONG_FRAME = new Uint8Array([0x8A, 0x00])
  static readonly #CLOSE_FRAME = new Uint8Array([0x88, 0x00])
  //
  static readonly #PING_INTERVAL = 30_000
  static readonly #PING_TIMEOUT = 60_000

  static connect<ReceiveEvents extends EventMap>(
    url: string | URL,
    options?: WebSocketManagerOptions,
  ): Promise<WebSocketManager<ReceiveEvents>> {
    const instance = new WebSocketManager<ReceiveEvents>(this.#CONSTRUCTOR_SYMBOL, url, options)
    return instance.#connect()
  }

  #url: string | URL
  #ws: WebSocket | null = null
  #encoder: TextEncoder
  #decoder: TextDecoder
  #logger: ConsolaInstance
  #messageQueue: Array<{ data: Uint8Array | string | EventPayload<ReceiveEvents>, opcode?: number }> = []
  // [TODO] Replace with WeakMap
  #eventListeners: Map<keyof ReceiveEvents, ((data: any) => void)[]> = new Map()
  #pingInterval: number | null = null
  #lastPongTime: number = Date.now()
  #reconnectAttempts = 0
  #maxReconnectAttempts = 5
  #reconnectInterval = 5_000

  get isConnected(): boolean {
    return this.#ws?.readyState === WebSocket.OPEN
  }

  private constructor(symbol: symbol, url: string | URL, options?: WebSocketManagerOptions) {
    if (symbol !== WebSocketManager.#CONSTRUCTOR_SYMBOL) {
      throw new WebSocketManagerError(
        'WebSocketManager cannot be instantiated directly. Use the static `connect` method instead.',
      )
    }

    this.#url = url
    this.#encoder = new TextEncoder()
    this.#decoder = new TextDecoder()
    this.#logger = options?.logger ?? createConsola()
  }

  close(code?: number, reason?: string) {
    this.send(WebSocketManager.#CLOSE_FRAME, WebSocketManager.#OPCODE_CONNECTION_CLOSE)
    this.#ws?.close(code, reason)
    this.#ws = null
    this.#stopPingInterval()
    this.#reconnect()
  }

  send(data: Uint8Array, opcode?: number): void
  send(data: string, opcode?: number): void
  send(data: EventPayload<ReceiveEvents>, opcode?: number): void
  send(dataOrEvent: Uint8Array | string | EventPayload<ReceiveEvents>, opcode?: number): void {
    const getOpcode = (opcode?: number): number => {
      if (opcode)
        return opcode

      if (typeof dataOrEvent === 'string') {
        return WebSocketManager.#OPCODE_TEXT
      }

      if (dataOrEvent instanceof Uint8Array) {
        return WebSocketManager.#OPCODE_BINARY
      }

      return WebSocketManager.#OPCODE_TEXT
    }

    if (!this.isConnected) {
      this.#enqueueMessage(dataOrEvent, getOpcode(opcode))
      return
    }

    const prepareFrame = (opcode?: number): Uint8Array => {
      opcode = getOpcode(opcode)

      if (typeof dataOrEvent === 'string') {
        return this.#createFrame(dataOrEvent, opcode)
      }

      if (dataOrEvent instanceof Uint8Array) {
        return this.#createFrame(dataOrEvent, opcode)
      }

      return this.#createFrame(dataOrEvent, opcode)
    }

    const frame = prepareFrame(opcode)

    this.#ws?.send(frame.buffer)
    this.#logger.log('Sent data:', dataOrEvent)
  }

  on<T extends keyof ReceiveEvents>(event: T, callback: (data: ReceiveEvents[T]) => void): void {
    if (!this.#eventListeners.has(event)) {
      this.#eventListeners.set(event, [])
    }

    this.#eventListeners.get(event)!.push(callback)
  }

  #emit<T extends keyof ReceiveEvents>(event: T, data: ReceiveEvents[T]): void {
    const callbacks = this.#eventListeners.get(event)

    callbacks?.forEach(callback => callback(data))
  }

  #enqueueMessage(data: Uint8Array | string | EventPayload<ReceiveEvents>, opcode?: number): void {
    this.#messageQueue.push({ data, opcode })
    this.#logger.warn('WebSocket is not open, message queued.')
  }

  #sendQueuedMessages(): void {
    while (this.#messageQueue.length > 0) {
      const { data, opcode } = this.#messageQueue.shift()!
      this.send(data as any, opcode)
    }
  }

  #connect(): Promise<WebSocketManager<ReceiveEvents>> {
    return new Promise<WebSocketManager<ReceiveEvents>>((resolve, reject) => {
      this.#ws = new WebSocket(this.#url)
      this.#ws.binaryType = 'arraybuffer'

      this.#ws.onopen = () => {
        this.#logger.log('WebSocket connection established')
        this.#startPingInterval()
        this.#sendQueuedMessages()
        resolve(this)
      }

      this.#ws.onmessage = this.#handleMessage.bind(this)

      this.#ws.onclose = (event) => {
        this.#logger.log('WebSocket connection closed:', event)
        this.#stopPingInterval()
        reject(new Error('WebSocket connection closed'))
        this.#reconnect()
      }

      this.#ws.onerror = (event) => {
        this.#logger.error('WebSocket error occurred:', event)
        reject(new Error('WebSocket connection error'))
      }
    })
  }

  #reconnect(): void {
    if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
      this.#reconnectAttempts++
      const reconnectDelay = Math.min(this.#reconnectInterval * 2 ** this.#reconnectAttempts, 30_000)
      this.#logger.log(`Reconnecting in ${reconnectDelay / 1_000}s...`)
      setTimeout(this.#connect.bind(this), reconnectDelay)
    }
    else {
      this.#logger.error('Max reconnection attempts reached. Please try again later.')
    }
  }

  #handleMessage(event: MessageEvent): void {
    const arrayBuffer = event.data as ArrayBuffer
    const data = new Uint8Array(arrayBuffer)

    if (data.length === 0) {
      return
    }

    const opcode = data[0]! & 0xF

    if (opcode === WebSocketManager.#OPCODE_PING) {
      this.#logger.log('Received ping')
      this.#pong()
    }
    else if (opcode === WebSocketManager.#OPCODE_PONG) {
      this.#logger.log('Received pong')
      this.#lastPongTime = Date.now()
    }
    else {
      this.#handleDataFrame(data)
    }
  }

  #handleDataFrame(data: Uint8Array) {
    try {
      const jsonString = this.#decoder.decode(data)
      const payload = JSON.parse(jsonString) as EventPayload<ReceiveEvents>
      this.#logger.log('Received object:', payload)
      this.#emit(
        payload.type,
        'data' in payload ? payload.data : undefined as ReceiveEvents[keyof ReceiveEvents],
      )
    }
    catch (error) {
      this.#logger.error('Failed to parse received data:', error)
    }
  }

  #ping(): void {
    this.send(WebSocketManager.#PING_FRAME, WebSocketManager.#OPCODE_PING)

    if (this.#isPingTimeoutExpired()) {
      this.#logger.warn('No pong received recently. Connection might be dead.')
      this.close()
    }
  }

  #isPingTimeoutExpired(): boolean {
    return (Date.now() - this.#lastPongTime) > WebSocketManager.#PING_TIMEOUT
  }

  #pong(): void {
    this.send(WebSocketManager.#PONG_FRAME, WebSocketManager.#OPCODE_PONG)
  }

  #createFrame(data: Uint8Array | string | object, opcode: number): Uint8Array {
    let binaryData: Uint8Array

    if (typeof data === 'object' && !(data instanceof Uint8Array)) {
      binaryData = this.#createJsonFrame(data)
    }
    else if (typeof data === 'string') {
      binaryData = this.#encoder.encode(data)
    }
    else {
      binaryData = data
    }

    return this.#prependOpcode(binaryData, opcode)
  }

  #createJsonFrame(value: object): Uint8Array {
    const jsonString = JSON.stringify(value)
    return this.#encoder.encode(jsonString)
  }

  /**
   * Prepended opcode need to be removed before processing the data frame on the server side.
   */
  #prependOpcode(data: Uint8Array, opcode: number): Uint8Array {
    const frame = new Uint8Array(data.length + 1)
    frame[0] = opcode
    frame.set(data, 1)
    return frame
  }

  #startPingInterval() {
    this.#pingInterval = setInterval(this.#ping.bind(this), WebSocketManager.#PING_INTERVAL) as unknown as number
  }

  #stopPingInterval() {
    if (this.#pingInterval !== null) {
      clearInterval(this.#pingInterval)
      this.#pingInterval = null
    }
  }
}

import type { EventMap, EventPayload } from '~~/types'
import { computed, shallowRef } from 'vue'

type WebSocketStatus = 'OPEN' | 'CONNECTING' | 'CLOSED' | 'EXPLICITLY_CLOSED' | 'CLOSING'

interface UseWebSocketOptions {
  /**
   * @default 5
   */
  maxReconnectAttempts?: number
  /**
   * @default 1000
   */
  reconnectInterval?: number
  /**
   * @default 30000
   */
  heartbeatInterval?: number
  /**
   * @default 5000
   */
  heartbeatTimeout?: number
  onConnected?: (ws: WebSocket) => void
  onDisconnected?: (ws: WebSocket, event: CloseEvent) => void
  onError?: (ws: WebSocket, event: Event) => void
}

const defaultOptions: UseWebSocketOptions = {
  maxReconnectAttempts: 5,
  reconnectInterval: 1_000,
  heartbeatInterval: 30_000,
  heartbeatTimeout: 5_000,
}

const setTimeout = globalThis.setTimeout.bind(globalThis)
const clearTimeout = globalThis.clearTimeout.bind(globalThis)
const setInterval = globalThis.setInterval.bind(globalThis)
const clearInterval = globalThis.clearInterval.bind(globalThis)

const encoder = new TextEncoder()
const encode = encoder.encode.bind(encoder)

export function useWebSocket<T extends EventMap>(options: UseWebSocketOptions) {
  options = Object.assign({}, defaultOptions, options)

  const status = shallowRef<WebSocketStatus>('CLOSED')
  const socket = shallowRef<WebSocket | null>(null)
  const data = shallowRef<EventPayload<T> | null>(null)
  const error = shallowRef<Event | null>(null)
  const lastHeartbeat = shallowRef<number>(Date.now())

  let reconnectAttempts = 0
  let reconnectTimeoutId: number | null = null
  let heartbeatIntervalId: number | null = null
  let heartbeatTimeoutId: number | null = null

  const isConnected = computed(() => status.value === 'OPEN')

  function startHeartbeat(): void {
    stopHeartbeat()
    heartbeatIntervalId = setInterval(() => {
      ping()
      startHeartbeatTimeout()
    }, options.heartbeatInterval) as unknown as number
  }

  function startHeartbeatTimeout(): void {
    if (heartbeatTimeoutId !== null) {
      clearTimeout(heartbeatTimeoutId)
    }

    heartbeatTimeoutId = setTimeout(() => {
      console.warn('Heartbeat timeout, closing connection')
      socket.value?.close()
    }, options.heartbeatTimeout) as unknown as number
  }

  function stopHeartbeat(): void {
    if (heartbeatIntervalId !== null) {
      clearInterval(heartbeatIntervalId)
      heartbeatIntervalId = null
    }

    if (heartbeatTimeoutId !== null) {
      clearTimeout(heartbeatTimeoutId)
      heartbeatTimeoutId = null
    }
  }

  async function connect(url: string | URL): Promise<void> {
    if (socket.value?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket connection is already open')
      return
    }

    socket.value = new WebSocket(url)
    status.value = 'CONNECTING'

    const addEventListener = socket.value.addEventListener.bind(socket.value)
    const { promise, reject, resolve } = Promise.withResolvers<void>()

    addEventListener('error', (event) => {
      error.value = event
      options.onError?.(event.target as WebSocket, event)
      console.error('WebSocket error:', event)
      reject(event)
    })

    addEventListener('close', (event) => {
      status.value = 'CLOSED'
      options.onDisconnected?.(event.target as WebSocket, event)
      stopHeartbeat()

      if (!event.wasClean) {
        console.warn('WebSocket connection closed unexpectedly:', event)
        reconnect()
      }
    })

    addEventListener('message', async (event: MessageEvent<Blob>) => {
      try {
        if (!(event.data instanceof Blob))
          throw new TypeError('Received message is not a Blob')

        const messageData = await event.data.text()
        const parsedData: EventPayload<T> = JSON.parse(messageData)

        if (parsedData.type === 'pong') {
          if (heartbeatTimeoutId !== null) {
            clearTimeout(heartbeatTimeoutId)
          }
        }
        else {
          data.value = parsedData
        }
      }
      catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    })

    addEventListener('open', (event) => {
      status.value = 'OPEN'
      options.onConnected?.(event.target as WebSocket)
      reconnectAttempts = 0
      error.value = null
      resolve()
      startHeartbeat()
    })

    await promise
  }

  function reconnect(): void {
    if (reconnectAttempts >= options.maxReconnectAttempts!) {
      console.error('Max reconnection attempts reached')
      return
    }

    reconnectAttempts++

    const delay = options.reconnectInterval! * 2 ** (reconnectAttempts - 1)

    // eslint-disable-next-line no-console
    console.log(`Attempting to reconnect in ${delay}ms...`)

    reconnectTimeoutId = setTimeout(() => {
      if (socket.value?.url) {
        connect(socket.value.url).then(ping)
      }
      else {
        console.error('No URL available for reconnection')
      }
    }, delay) as unknown as number
  }

  function send(message: EventPayload<T>): boolean {
    if (!socket.value) {
      console.error('WebSocket instance does not exist.')
      return false
    }

    if (socket.value.readyState !== WebSocket.OPEN) {
      console.error(`WebSocket is not open. Current state: ${socket.value.readyState}`)
      return false
    }

    try {
      const encodedMessage = encode(JSON.stringify(message))
      socket.value.send(encodedMessage)
      return true
    }
    catch (error) {
      if (error instanceof Error) {
        console.error('Failed to send message:', error.message)
      }
      else {
        console.error('An unknown error occurred while sending the message')
      }

      return false
    }
  }

  function close(code?: number, reason?: string): void {
    stopHeartbeat()

    if (reconnectTimeoutId !== null) {
      clearTimeout(reconnectTimeoutId)
      reconnectTimeoutId = null
    }

    socket.value?.close(code, reason)
    status.value = 'CLOSING'
  }

  function ping(): void {
    send({ type: 'ping' } satisfies EventPayload<{ ping: void }> as EventPayload<T>)
  }

  return { close, connect, data, ping, send, status, isConnected, lastHeartbeat }
}

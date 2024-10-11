import type { EventPayload } from '~~/types'
import { watch } from 'vue'
import { useWebSocket } from '~/composables/useWebSocket'
import { createEmitter } from '~/utils/createEmitter'
import { createWebSocketURL } from '~/utils/createWebSocketUrl'
import type { ReceiveEvents, SendEvents } from '~/workers/test/types'
import { createPostMessage } from '~/workers/utils/createPostMessage'

const setTimeout = globalThis.setTimeout.bind(globalThis)

export function onMessage() {
  const emitter = createEmitter<ReceiveEvents>()
  const post = createPostMessage<SendEvents>()

  emitter.on('ping', () => {
    post({ type: 'pong' })
    post({ type: 'connected', data: 'worker' })
  })

  emitter.on('init', async () => {
    const webSocket = useWebSocket<{
      // [TODO] Share event types between websocket and main worker
      echo: string
    }>({
      onConnected: () => post({ type: 'connected', data: 'webSocket' }),
      onError: () => post({ type: 'error' }),
    })

    watch([webSocket.status, webSocket.isConnected, webSocket.lastHeartbeat], ([...args]) => {
      // eslint-disable-next-line no-console
      console.info('WebSocket connection status:', args)
    })

    await webSocket.connect(createWebSocketURL('/_ws'))
      .then(() => {
        webSocket.ping()
        watch(webSocket.data, (value) => {
          // eslint-disable-next-line no-console
          console.log('WebSocket data:', value)
        })
        webSocket.send({ type: 'echo', data: 'Hello, WebSocket!' })
        setTimeout(() => {
          // [INFO] Test closing the `WebSocket` connection
          webSocket.close(3_001, 'Explicitly closing the WebSocket connection')
        }, 15_000)
      })
      .catch((error) => {
        // [TODO] Notify main thread of connection error
        console.error('Failed to connect to WebSocket server:', error)
      })
  })

  return (event: MessageEvent<EventPayload<ReceiveEvents>>) => {
    // eslint-disable-next-line no-console
    console.log('Worker received message:', event.data)
    emitter.emit(event.data.type, (event.data as any).data)
  }
}

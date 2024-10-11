import type { EventPayload } from '~~/types'
import type { ReceiveEvents, SendEvents } from '~/workers/test/types'
import { createPostMessage } from '~/workers/utils/createPostMessage'

export function onMessage(): (this: DedicatedWorkerGlobalScope, event: MessageEvent<any>) => any {
  const setTimeout = globalThis.setTimeout.bind(globalThis)

  const emitter = createEmitter<ReceiveEvents>()
  const post = createPostMessage<SendEvents>()

  emitter.on('ping', () => {
    post({ type: 'pong' })
  })

  emitter.on('init', async () => {
    try {
      const webSocket = await useWebSocket().connect('/_ws')

      webSocket.addEventListener('message', (event: MessageEvent<any>) => {
        // eslint-disable-next-line no-console
        console.info('Received message:', event.data)
      })

      webSocket.send('ping')
      // [TODO] Set connection status
      // [TODO] Update connection status
      // [TODO] Notify main thread of connection status

      setTimeout(() => {
        // [INFO] Test closing the `WebSocket` connection
        webSocket.close(3_000, 'Client disconnect')
      }, 5_000)
    }
    catch (error) {
      // [TODO] Notify main thread of connection error
      console.error('Failed to connect to WebSocket server:', error)
    }
  })

  return (event: MessageEvent<EventPayload<ReceiveEvents>>) => {
    // eslint-disable-next-line no-console
    console.log('Worker received message:', event.data)

    emitter.emit(event.data.type, (event.data as any).data)
  }
}

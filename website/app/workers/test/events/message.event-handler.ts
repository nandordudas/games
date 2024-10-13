/// <reference lib="WebWorker"/>

import type { EventPayload } from '~~/types'
import { consola } from 'consola'
import { createWebSocketURL } from '~/utils/createWebSocketUrl'
import type { ReceiveEvents, SendEvents } from '~/workers/test/types'
import { createPostMessage } from '~/workers/utils/createPostMessage'
import { WebSocketManager } from '~/workers/utils/web-socket-manager'

export function onMessage() {
  const emitter = createEmitter<ReceiveEvents>()
  const post = createPostMessage<SendEvents>()

  emitter.on('ping', () => {
    post({ type: 'pong' })
    post({ type: 'connected', data: 'worker' })
  })

  emitter.on('init', async () => {
    interface S {
      message: { content: string }
      ping: void
    }

    interface R {
      connected: string
    }

    try {
      const wsm = await WebSocketManager.connect<R, S>({
        url: createWebSocketURL('/_ws'),
        logger: consola.withTag('ws'),
      })

      wsm.send('string')
      wsm.send({ type: 'message', data: { content: 'Hello message' } })
      wsm.send(new TextEncoder().encode('Hello, WebSocket!'))

      wsm.on('connected', (data) => {
        // eslint-disable-next-line no-console
        console.log('Received message', data)
      })

      // eslint-disable-next-line no-console
      console.log('WebSocketManager connected:', wsm)
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

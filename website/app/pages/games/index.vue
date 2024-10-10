<script setup lang="ts">
import { consola } from 'consola'

type EventPayload = unknown // [TODO] Replace with actual type

const logger = consola.withTag('pages:games')

onMounted(() => {
  useWebSocket()
    .connect('/_ws')
    .then((ws) => {
      ws.addEventListener('message', (event: MessageEvent<EventPayload>) => {
        logger.info('Received message:', event.data)
      })

      ws.send('ping')

      setTimeout(() => {
        ws.close(3000, 'Client disconnect')
      }, 5_000)
    })
    .catch((error) => {
      logger.error('Failed to connect to WebSocket server:', error)
    })
})

function useWebSocket() {
  /**
   * @throws If the path is not a valid URL.
   */
  async function connect(path: string | URL) {
    const { promise, reject, resolve } = Promise.withResolvers<WebSocket>()
    const ws = new WebSocket(createWebSocketURL(path))

    ws.addEventListener('error', (event) => {
      logger.error('WebSocket error:', event)
      reject(event)
    })

    ws.addEventListener('open', (event) => {
      logger.success('Connected to WebSocket server:', ws.url)
      resolve(event.target as WebSocket)
    })

    return await promise
  }

  return {
    connect,
  }
}

/**
 * @throws If the path is not a valid URL.
 */
function createWebSocketURL(path: string | URL): URL {
  const protocol = location.protocol.replace('http', 'ws')

  return new URL(path, `${protocol}//${location.host}`)
}
</script>

<template>
  <div>
    {{ $route.path }}
  </div>
</template>

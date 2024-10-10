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
        ws.close(3_000, 'Client disconnect')
      }, 5_000)
    })
    .catch((error) => {
      logger.error('Failed to connect to WebSocket server:', error)
    })
})
</script>

<template>
  <div>
    {{ $route.path }}
  </div>
</template>

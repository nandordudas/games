<script setup lang="ts">
import { consola } from 'consola'

type EventPayload = unknown // [TODO] Replace with actual type

const logger = consola.withTag('pages:games')
const { data: todos, error } = await useFetch('/api/todos')

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
    <ul v-if="todos?.length || error">
      <li v-for="todo in todos" :key="todo.id">
        {{ todo.title }}
      </li>
    </ul>
    <p v-else>
      No todos found
    </p>
  </div>
</template>

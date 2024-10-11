<script setup lang="ts">
const { data: todos, error } = await useFetch('/api/todos')
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

    <ClientOnly>
      <GameTest />
    </ClientOnly>
  </div>
</template>

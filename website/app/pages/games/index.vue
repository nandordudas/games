<script setup lang="ts">
const { data: todos, error } = await useFetch('/api/todos')
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="min-h-screen flex flex-col justify-center">
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
  </div>
</template>

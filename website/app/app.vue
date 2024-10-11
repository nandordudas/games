<script setup lang="ts">
const config = useRuntimeConfig()

useHead({
  meta: [
    { name: 'packageVersion', content: config.public.packageVersion },
  ],
  templateParams: {
    separator: '·',
    value: 'Games', // [TODO] Replace with `nuxt-site-config`
  },
  titleTemplate: '%s %separator %value',
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <UNotifications />
  </div>
</template>

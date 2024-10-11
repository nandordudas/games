<script lang="ts">
import { consola } from 'consola'

import Worker from '~/workers/test/test.worker?worker'
import type { ReceiveEvents, SendEvents } from '~/workers/test/types'

if (import.meta.server)
  throw createError('This code will only run on the client side')

const logger = consola.withTag('components:game:test')
</script>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

const toast = useToast()

// [INFO] Generic types have swapped places
const { on, post } = useWebWorker<ReceiveEvents, SendEvents>(new Worker({ name: 'Test' }))

// [TODO] Use emitter instead of on and post
// eslint-disable-next-line complexity
on('message', (event) => {
  logger.info('Received message:', event)

  if (event.data.type === 'pong') {
    post({ type: 'init' })
  }

  if (event.data.type === 'error') {
    toast.add({ title: 'Error occurred' })
  }

  if (event.data.type === 'connected') {
    if (event.data.data === 'worker') {
      toast.add({ title: 'Worker connected' })
    }

    if (event.data.data === 'webSocket') {
      toast.add({ title: 'WebSocket connected' })
    }
  }
})

post({ type: 'ping' })
</script>

<template>
  <div>
    [test]
  </div>
</template>

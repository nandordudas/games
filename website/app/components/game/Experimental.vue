<script lang="ts">
import type { EventMap, EventPayload, Fn, PromiseResolver } from '~~/types'
import { consola } from 'consola'
import Worker from '~/workers/experimental/experimental.worker?worker'

if (import.meta.server)
  throw createError('This code will only run on the client side')

const logger = consola.withTag('[GameExperimental]')

interface WorkerWrapperContract<Schema extends EventMap, Data = EventPayload<Schema>> {
  postMessage: (message: Data, options?: StructuredSerializeOptions) => void
  terminate: () => void
  clearMessageQueue: () => void
  flushStream: () => void
  getQueueLength: () => number
  subscribe: (callback: Fn<[Data], void>) => () => void
}

class WorkerWrapper<
  Schema extends EventMap,
  Data = EventPayload<Schema>,
> implements WorkerWrapperContract<Schema, Data> {
  #worker: Worker
  #messageQueue: Data[] = []
  #resolvers: PromiseResolver<Data>[] = []
  #isListening: boolean = false
  #subscriptions: Set<AbortController> = new Set()

  static create<Schema extends EventMap, Data = EventPayload<Schema>>(
    worker: Worker,
  ): WorkerWrapperContract<Schema, Data> {
    const instance = new WorkerWrapper<Schema, Data>(worker)

    return {
      postMessage: instance.postMessage.bind(instance),
      subscribe: instance.subscribe.bind(instance),
      terminate: instance.terminate.bind(instance),
      clearMessageQueue: instance.clearMessageQueue.bind(instance),
      flushStream: instance.flushStream.bind(instance),
      getQueueLength: instance.getQueueLength.bind(instance),
    }
  }

  constructor(worker: Worker) {
    this.#worker = worker
  }

  postMessage(message: Data, options?: StructuredSerializeOptions): void {
    try {
      this.#worker.postMessage(message, options)
    }
    catch (error) {
      console.error('Error posting message to worker:', error)
    }
  }

  terminate(): void {
    this.#worker.terminate()
    this.clearMessageQueue()
    this.flushStream()
    this.#subscriptions.clear()
    this.#isListening = false
  }

  clearMessageQueue(): void {
    this.#messageQueue = []
  }

  flushStream(): void {
    this.#resolvers = []
  }

  getQueueLength(): number {
    return this.#messageQueue.length
  }

  subscribe(callback: Fn<[Data], void>): () => void {
    if (!this.#isListening) {
      this.#startListening()
    }

    const runner = async (abortController: AbortController): Promise<void> => {
      try {
        for await (const message of this.#messageStream(abortController.signal)) {
          if (abortController.signal.aborted) {
            return
          }

          callback(message)
        }
      }
      catch (error) {
        if (!abortController.signal.aborted) {
          callback({ type: 'error', payload: error } as Data)
        }
      }
    }

    const abortController = new AbortController()
    this.#subscriptions.add(abortController)
    runner(abortController)

    return () => {
      abortController.abort()
      this.#subscriptions.delete(abortController)

      if (this.#subscriptions.size === 0) {
        this.#stopListening()
      }
    }
  }

  #startListening() {
    if (this.#isListening) {
      return
    }

    this.#worker.addEventListener('message', this.#enqueueMessage)
    this.#isListening = true
  }

  #stopListening() {
    if (!this.#isListening) {
      return
    }

    this.#worker.removeEventListener('message', this.#enqueueMessage)
    this.#isListening = false
  }

  #enqueueMessage = (event: MessageEvent<Data>) => {
    if (this.#resolvers.length) {
      const resolver = this.#resolvers.shift()!
      resolver(event.data)
    }
    else {
      this.#messageQueue.push(event.data)
    }
  }

  /**
   * Generates an async iterator for messages from the worker.
   * @param signal An {@link AbortSignal} to cancel the stream.
   * @yields Messages from the worker queue or newly received messages.
   */
  async *#messageStream(signal: AbortSignal): AsyncGenerator<Data> {
    while (!signal.aborted) {
      if (this.getQueueLength()) {
        yield this.#messageQueue.shift()!
      }
      else {
        if (signal.aborted) {
          break
        }

        const { promise, resolve } = Promise.withResolvers<Data>()
        this.#resolvers.push(resolve)
        yield promise
      }
    }
  }
}
</script>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

const {
  postMessage,
  subscribe,
  terminate,
} = WorkerWrapper.create<{ ping: void }>(new Worker({ name: 'Experimental' }))

onBeforeUnmount(() => {
  terminate()
})

onMounted(async () => {
  postMessage({ type: 'ping' })

  subscribe((message) => {
    logger.withTag('[message received from worker]').log(message)
  })
})
</script>

<template>
  <div>
    [Experimental]
  </div>
</template>

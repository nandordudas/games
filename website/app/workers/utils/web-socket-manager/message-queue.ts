import type { EventMap } from '~~/types'
import type { Data } from '~/workers/utils/web-socket-manager/types'

interface QueueItem<T extends EventMap> {
  data: Data<T>
  opcode?: number
}

export class MessageQueue<T extends EventMap> {
  #queue: QueueItem<T>[] = []

  get isEmpty(): boolean {
    return this.#queue.length === 0
  }

  enqueue(data: Data<T>, opcode?: number): void {
    this.#queue.push({ data, opcode })
  }

  dequeue(): QueueItem<T> | undefined {
    return this.#queue.shift()
  }
}

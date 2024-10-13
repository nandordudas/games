import type { Fn } from '~~/types'
import { setTimeout } from '~/workers/utils/constants'

interface ReconnectManagerOptions {
  maxReconnectAttempts: number
  reconnectInterval: number
}

export class ReconnectManager {
  static readonly #defaultReconnectDelay: number = 30_000

  #reconnectAttempts: number
  #maxReconnectAttempts: number
  #reconnectInterval: number

  get canReconnect(): boolean {
    return this.#reconnectAttempts < this.#maxReconnectAttempts
  }

  get nextDelay(): number {
    return Math.min(this.#reconnectInterval * (2 ** this.#reconnectAttempts), ReconnectManager.#defaultReconnectDelay)
  }

  constructor(options: ReconnectManagerOptions) {
    this.#reconnectAttempts = 0
    this.#maxReconnectAttempts = options.maxReconnectAttempts
    this.#reconnectInterval = options.reconnectInterval
  }

  run(callback: Fn): void {
    if (this.canReconnect) {
      setTimeout(callback, this.nextDelay)
      this.#incrementAttempts()
    }
    else {
      // [TODO] Replace with logger
      console.error('Max reconnection attempts reached')
    }
  }

  resetAttempts(): void {
    this.#reconnectAttempts = 0
  }

  #incrementAttempts(): void {
    this.#reconnectAttempts++
  }
}

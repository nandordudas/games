import type { Fn } from '~~/types'
import { clearInterval, setInterval } from '~/workers/utils/constants'

interface HeartbeatManagerOptions {
  pingInterval: number
  pingTimeout: number
  onPing: Fn
  onPingTimeout: Fn
}

export class HeartbeatManager {
  #pingInterval: number
  #pingTimeout: number
  #lastPongTime: number = Date.now()
  #pingIntervalId: ReturnType<typeof setInterval> | null = null
  #onPing: Fn
  #onPingTimeout: Fn

  constructor(options: HeartbeatManagerOptions) {
    if (options.pingTimeout < options.pingInterval) {
      throw new RangeError('Ping timeout must be greater than ping interval')
    }

    this.#pingInterval = options.pingInterval
    this.#pingTimeout = options.pingTimeout
    this.#onPing = options.onPing
    this.#onPingTimeout = options.onPingTimeout
  }

  start(): void {
    this.#pingIntervalId = setInterval(() => {
      this.#onPing()
      if (this.#isPingTimeoutExpired()) {
        this.#onPingTimeout()
      }
    }, this.#pingInterval)
  }

  stop(): void {
    if (this.#pingIntervalId) {
      clearInterval(this.#pingIntervalId)
      this.#pingIntervalId = null
    }
    this.#lastPongTime = 0
  }

  updateLastPongTime(): void {
    this.#lastPongTime = Date.now()
  }

  #isPingTimeoutExpired(): boolean {
    return (Date.now() - this.#lastPongTime) > this.#pingTimeout
  }
}

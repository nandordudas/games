import type { EventMap } from '~~/types'

export class Emitter<T extends EventMap> {
  private listeners: Partial<{ [K in keyof T]: ((data: T[K]) => void)[] }> = {}

  on<K extends keyof T>(event: K, callback: (data: T[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event]!.push(callback)
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    const eventListeners = this.listeners[event]
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data))
    }
  }

  off<K extends keyof T>(event: K, callback: (data: T[K]) => void): void {
    const eventListeners = this.listeners[event]
    if (eventListeners) {
      this.listeners[event] = eventListeners.filter(cb => cb !== callback)
    }
  }
}

import type { EventMap, EventType, Handler, Union } from '~~/types'

export interface Emitter<Events extends EventMap> {
  on: <Key extends keyof Events & EventType>(key: Key, handler: Handler<Events[Key]>) => void
  once: <Key extends keyof Events & EventType>(key: Key, handler: Handler<Events[Key]>) => void
  off: <Key extends keyof Events & EventType>(key: Key, handler?: Handler<Events[Key]>) => void
  emit: Union<[
    <Key extends keyof Events & EventType>(key: Key, event: Events[Key]) => void,
    <Key extends keyof Events & EventType>(key: undefined extends Events[Key] ? Key : never) => void,
  ]>
}

export function createEmitter<Events extends EventMap>(): Emitter<Events> {
  const listeners = new Map<EventType, Set<Handler>>()

  function on<Key extends keyof Events & EventType>(key: Key, handler: Handler<Events[Key]>): void {
    if (!listeners.has(key))
      listeners.set(key, new Set())

    listeners.get(key)?.add(handler)
  }

  function once<Key extends keyof Events & EventType>(key: Key, handler: Handler<Events[Key]>): void {
    const onceHandler: Handler<Events[Key]> = (...data) => {
      off(key, onceHandler)
      handler(...data)
    }

    on(key, onceHandler)
  }

  function off<Key extends keyof Events & EventType>(key: Key, handler?: Handler<Events[Key]>): void {
    if (handler)
      listeners.get(key)?.delete(handler)
    else
      listeners.delete(key)
  }

  function emit<Key extends keyof Events & EventType>(key: Key, event?: Events[Key]): void {
    const handlers = listeners.get(key)

    handlers?.forEach(handler => handler(event))
  }

  return { on, once, off, emit }
}

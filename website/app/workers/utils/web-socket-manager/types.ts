import type { EventMap, EventPayload, Fn } from '~~/types'

export type Data<T extends EventMap> = Uint8Array | string | EventPayload<T>

export interface LoggerContract {
  log: Fn
  error: Fn
  warn: Fn
}

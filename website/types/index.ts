export type EventType = string | symbol
export type Empty = void | undefined
export type EventMap = Record<EventType, any>

// [TODO] Make this work with deep readonly
export type EventPayload<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends Empty
    ? { type: K }
    : { type: K, data: T[K] }
}[keyof T]

export type Union<U extends unknown[]> = U extends [infer F, ...infer R]
  ? F & Union<R>
  : unknown

export type Handler<T = any, R = void> = (...data: T[]) => R

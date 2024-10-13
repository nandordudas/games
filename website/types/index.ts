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

// [TODO] Use this to make type below work
export type Fn<T = any, TReturn = void> = (...args: T extends any[] ? T : [T]) => TReturn
export type Handler<T = any, TReturn = void> = (...data: T[]) => TReturn
export type DisposeFunction = () => void
export type PromiseResolver<T> = ReturnType<typeof Promise.withResolvers<T>>['resolve']

import type { EventMap, EventPayload } from '~~/types'

export function createPostMessage<SendEvents extends EventMap>() {
  const postMessage = globalThis.postMessage.bind(globalThis)

  function post(payload: EventPayload<SendEvents>, options?: StructuredSerializeOptions): void {
    postMessage(payload, options)
  }

  return post
}

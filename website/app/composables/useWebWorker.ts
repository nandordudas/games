import type { EventMap, EventPayload } from '~~/types'

type DisposeFunction = () => void

/**
 * @throws If used on the server side.
 */
export function useWebWorker<
  SendEvents extends EventMap,
  ReceiveEvents extends EventMap,
>(worker: Worker) {
  if (import.meta.server)
    throw new Error('useWebWorker should only be used on the client side')

  function on<
    T extends keyof WorkerEventMap,
    K extends WorkerEventMap[T] = WorkerEventMap[T],
  >(
    type: T,
    listener: (event: T extends 'message' ? MessageEvent<EventPayload<ReceiveEvents>> : K) => void,
    options?: AddEventListenerOptions,
  ): DisposeFunction {
    worker.addEventListener(type, listener as EventListener, options)

    return () => {
      worker.removeEventListener(type, listener as EventListener, options)
    }
  }

  function post(payload: EventPayload<SendEvents>, options?: StructuredSerializeOptions): void {
    worker.postMessage(payload, options)
  }

  function terminate(): void {
    worker.terminate()
  }

  function stop(): void {
    terminate()
  }

  onScopeDispose(() => {
    stop()
  })

  return { on, post, terminate }
}

export function onError(): (this: DedicatedWorkerGlobalScope, event: ErrorEvent) => any {
  return (event: ErrorEvent) => {
    // [TODO] Check `event.error` type
    console.error('Worker error:', event.error)
  }
}

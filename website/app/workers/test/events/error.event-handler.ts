export function onError() {
  return (event: ErrorEvent) => {
    // [TODO] Check `event.error` type
    console.error('Worker error:', event.error)
  }
}

/**
 * @throws If used on the server side.
 */
export function useWebSocket() {
  if (import.meta.server)
    throw new Error('useWebWorker should only be used on the client side')

  /**
   * @throws If the path is not a valid URL.
   */
  async function connect(path: string | URL): Promise<WebSocket> {
    const { promise, reject, resolve } = Promise.withResolvers<WebSocket>()
    const ws = new WebSocket(createWebSocketURL(path))

    ws.addEventListener('error', (event) => {
      reject(event)
    })

    ws.addEventListener('open', (event) => {
      if (event.target instanceof WebSocket) {
        resolve(event.target as WebSocket)
      }
      else {
        reject(new TypeError('The WebSocket target is not an instance of WebSocket.'))
      }
    })

    return await promise
  }

  return {
    connect,
  }
}

/**
 * [TODO] Extract this to a shared utility
 * @throws If the path is not a valid URL.
 */
export function createWebSocketURL(path: string | URL): URL {
  const protocol = location.protocol.replace('http', 'ws')

  return new URL(path, `${protocol}//${location.host}`)
}

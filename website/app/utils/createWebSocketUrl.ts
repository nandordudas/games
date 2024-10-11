/**
 * @throws If the path is not a valid URL.
 */
export function createWebSocketURL(path: string | URL): URL {
  const location = globalThis.location
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'

  return new URL(path, `${protocol}//${location.host}`)
}

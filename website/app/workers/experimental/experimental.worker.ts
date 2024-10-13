import { type ConsolaInstance, createConsola, LogLevels } from 'consola'

type ErrorEventHandler = (event: ErrorEvent) => void
type MessageEventHandler<T = any> = (event: MessageEvent<T>) => void

const postMessage = globalThis.postMessage.bind(globalThis)
const setInterval = globalThis.setInterval.bind(globalThis)

main(createConsola({ level: LogLevels.debug }).withTag('[experimental]'))

function main<T = any>(logger: ConsolaInstance): void {
  const addEventListener = globalThis.addEventListener.bind(globalThis)

  addEventListener('error', onError(logger))
  addEventListener('message', onMessage<T>(logger))

  logger.info('worker loaded')
  setInterval(pong, 1_000)
}

function onError(logger: ConsolaInstance): ErrorEventHandler {
  return (event) => {
    logger.error(event.error)
  }
}

function onMessage<T>(logger: ConsolaInstance): MessageEventHandler<T> {
  return (event) => {
    logger.withTag('[message received from main thread]').log(event.data)

    if (event.data.type === 'ping') {
      pong()
    }
  }
}

function pong(): void {
  postMessage('pong')
}

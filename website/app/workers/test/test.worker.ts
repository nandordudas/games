import { onError } from '~/workers/test/events/error.event-handler'
import { onMessage } from '~/workers/test/events/message.event-handler'

const addEventListener = globalThis.addEventListener.bind(globalThis)

main()

function main(): void {
  addEventListener('error', onError())
  addEventListener('message', onMessage())
}

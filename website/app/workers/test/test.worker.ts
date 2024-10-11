import { onError } from '~/workers/test/events/error.event-handler'
import { onMessage } from '~/workers/test/events/message.event-handler'

const addEventListener = globalThis.addEventListener.bind(globalThis)

addEventListener('error', onError())
addEventListener('message', onMessage())

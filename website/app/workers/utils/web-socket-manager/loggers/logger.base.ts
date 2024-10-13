import type { LoggerContract } from '~/workers/utils/web-socket-manager/types'

export abstract class BaseLogger implements LoggerContract {
  abstract log(message: string): void
  abstract error(message: string): void
  abstract warn(message: string): void
}

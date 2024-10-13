import type { ConsolaInstance } from 'consola'

import { BaseLogger } from '~/workers/utils/web-socket-manager/loggers/logger.base'

export class ConsolaLogger extends BaseLogger {
  #logger: ConsolaInstance

  constructor(logger: ConsolaInstance) {
    super()
    this.#logger = logger
  }

  override log(message: string): void {
    this.#logger.info(message)
  }

  override error(message: string): void {
    this.#logger.error(message)
  }

  override warn(message: string): void {
    this.#logger.warn(message)
  }
}

import * as schema from '~~/server/database/schema'

import { drizzle } from 'drizzle-orm/d1'

export { and, eq, or, sql } from 'drizzle-orm'
export const tables = schema

export function useDB() {
  return drizzle(hubDatabase(), { schema })
}

import type { H3Event } from 'h3'
import { getQuery } from 'h3'

// Server-side pagination helpers (issue #13). The list endpoints used to run
// unbounded `findMany()` calls that loaded an entire table into memory on every
// request. These helpers give every list endpoint a consistent, hard-capped
// pagination contract.

export const DEFAULT_PAGE_SIZE = 20
// Hard cap so a caller can never ask for an unbounded page (the whole point of
// issue #13). Even `?pageSize=100000` is clamped to this.
export const MAX_PAGE_SIZE = 100

export interface PageParams {
  page: number
  pageSize: number
  skip: number
  take: number
}

export interface PageEnvelope<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  const i = Math.floor(n)
  if (i < min) return min
  if (i > max) return max
  return i
}

/**
 * Parse `?page` (1-based) and `?pageSize` from the request, clamping pageSize to
 * [1, MAX_PAGE_SIZE] and defaulting to DEFAULT_PAGE_SIZE. Invalid/missing values
 * fall back to the defaults rather than erroring.
 */
export function getPageParams(
  event: H3Event,
  opts: { defaultPageSize?: number; maxPageSize?: number } = {}
): PageParams {
  const query = getQuery(event)
  const maxPageSize = opts.maxPageSize ?? MAX_PAGE_SIZE
  const defaultPageSize = Math.min(opts.defaultPageSize ?? DEFAULT_PAGE_SIZE, maxPageSize)
  const page = clampInt(query.page, 1, Number.MAX_SAFE_INTEGER, 1)
  const pageSize = clampInt(query.pageSize, 1, maxPageSize, defaultPageSize)
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

/** Read a single string query param (h3 may hand back string | string[]). */
export function getStringParam(event: H3Event, key: string): string {
  const raw = getQuery(event)[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value.trim() : ''
}

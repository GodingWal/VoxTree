/**
 * Serialize a Drizzle row to the snake_case shape PostgREST returned.
 *
 * Server pages historically passed database rows straight into client
 * components and JSON responses typed with snake_case fields
 * (created_at, avatar_url, ...). Drizzle rows are camelCase with Date
 * objects; this converts top-level keys back and Dates to ISO strings
 * so those consumers keep working unchanged after the Phase 4
 * migration. Nested values (jsonb payloads) are passed through as-is,
 * matching PostgREST behavior for jsonb columns.
 */
export function toSnakeRow<T extends Record<string, unknown>>(
  row: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    out[snake] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

export function toSnakeRows<T extends Record<string, unknown>>(
  rows: T[],
): Array<Record<string, unknown>> {
  return rows.map(toSnakeRow);
}

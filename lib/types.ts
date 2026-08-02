/**
 * Compatibility shim. The hand-written domain types moved to `types/domain/*`
 * (kept separate from the generated `types/database.ts`). This re-export keeps
 * the `@/lib/types` specifier working for existing importers; prefer importing
 * from `@/types/domain` in new code.
 */
export * from '@/types/domain'

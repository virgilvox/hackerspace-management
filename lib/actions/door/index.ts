/**
 * Barrel re-export for the door server actions.
 *
 * Split from the original single `door.ts` into section files. This barrel
 * keeps `@/lib/actions/door` resolving to the same set of exports.
 *
 * Do NOT add `'use server'` here. The directive lives on the section files
 * (connections/operate/self-entry); re-exports preserve the marking.
 */

export * from './connections'
export * from './operate'
export * from './self-entry'

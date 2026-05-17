import { describe, it, expect } from 'vitest'
import {
  headingText,
  slugifyHeading,
  makeHeadingSlugger,
  isInDocumentHref,
} from '@/lib/markdown-anchors'

describe('headingText', () => {
  it('reads strings and numbers', () => {
    expect(headingText('Hello')).toBe('Hello')
    expect(headingText(42)).toBe('42')
  })
  it('flattens arrays and element children', () => {
    expect(headingText(['Get ', 'started'])).toBe('Get started')
    expect(headingText({ props: { children: ['Bold ', { props: { children: 'bit' } }] } })).toBe('Bold bit')
  })
  it('ignores null/boolean', () => {
    expect(headingText(null)).toBe('')
    expect(headingText(true)).toBe('')
  })
})

describe('slugifyHeading', () => {
  it('lowercases, strips punctuation, hyphenates', () => {
    expect(slugifyHeading('Overview')).toBe('overview')
    expect(slugifyHeading('  Getting Started!  ')).toBe('getting-started')
    expect(slugifyHeading('A & B / C')).toBe('a-b-c')
  })
  it('collapses repeats and trims hyphens', () => {
    expect(slugifyHeading('-- weird   spacing --')).toBe('weird-spacing')
  })
})

describe('makeHeadingSlugger', () => {
  it('dedupes repeated headings within a document', () => {
    const slug = makeHeadingSlugger()
    expect(slug('Setup')).toBe('setup')
    expect(slug('Setup')).toBe('setup-1')
    expect(slug('Setup')).toBe('setup-2')
    expect(slug('Other')).toBe('other')
  })
  it('falls back to "section" for empty headings', () => {
    const slug = makeHeadingSlugger()
    expect(slug('')).toBe('section')
    expect(slug('   ')).toBe('section-1')
  })
})

describe('isInDocumentHref', () => {
  it('is true only for hash links', () => {
    expect(isInDocumentHref('#overview')).toBe(true)
    expect(isInDocumentHref('https://example.com')).toBe(false)
    expect(isInDocumentHref('/ops')).toBe(false)
    expect(isInDocumentHref(undefined)).toBe(false)
  })
})

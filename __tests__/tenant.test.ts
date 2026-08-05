import { describe, it, expect } from 'vitest'
import { resolveTenantConfig, isMarketingPath } from '@/lib/tenant'

describe('resolveTenantConfig', () => {
  it('applies platform defaults when every flag is empty', () => {
    expect(resolveTenantConfig({})).toEqual({
      singleTenant: false,
      siteName: 'hackerspace.sh',
      appUrl: 'http://localhost:3000',
      spaceSlug: null,
      openJoin: false,
      allowSpaceCreation: true,
      showMarketing: true,
    })
  })

  it('treats singleTenant as true only for the exact string "true"', () => {
    expect(resolveTenantConfig({ singleTenant: 'true' }).singleTenant).toBe(true)
    expect(resolveTenantConfig({ singleTenant: 'TRUE' }).singleTenant).toBe(false)
    expect(resolveTenantConfig({ singleTenant: '1' }).singleTenant).toBe(false)
    expect(resolveTenantConfig({ singleTenant: '' }).singleTenant).toBe(false)
  })

  describe('single-tenant mode', () => {
    it('forbids space creation and hides marketing by default', () => {
      const cfg = resolveTenantConfig({ singleTenant: 'true' })
      expect(cfg.allowSpaceCreation).toBe(false)
      expect(cfg.showMarketing).toBe(false)
    })

    it('lowercases the configured space slug', () => {
      expect(
        resolveTenantConfig({ singleTenant: 'true', spaceSlug: 'HeatSync-Labs' })
          .spaceSlug,
      ).toBe('heatsync-labs')
    })

    it('falls back to null slug when unset or blank', () => {
      expect(
        resolveTenantConfig({ singleTenant: 'true' }).spaceSlug,
      ).toBeNull()
      expect(
        resolveTenantConfig({ singleTenant: 'true', spaceSlug: '   ' }).spaceSlug,
      ).toBeNull()
    })

    it('enables open join only when openJoin is exactly "true"', () => {
      expect(
        resolveTenantConfig({ singleTenant: 'true', openJoin: 'true' }).openJoin,
      ).toBe(true)
      expect(
        resolveTenantConfig({ singleTenant: 'true', openJoin: 'false' }).openJoin,
      ).toBe(false)
      expect(
        resolveTenantConfig({ singleTenant: 'true', openJoin: 'TRUE' }).openJoin,
      ).toBe(false)
      expect(
        resolveTenantConfig({ singleTenant: 'true' }).openJoin,
      ).toBe(false)
    })
  })

  it('ignores openJoin in multi-tenant mode even when set to "true"', () => {
    expect(
      resolveTenantConfig({ openJoin: 'true' }).openJoin,
    ).toBe(false)
    expect(
      resolveTenantConfig({ singleTenant: 'false', openJoin: 'true' }).openJoin,
    ).toBe(false)
  })

  describe('showMarketing explicit override', () => {
    it('re-enables marketing in single-tenant mode when set to "true"', () => {
      expect(
        resolveTenantConfig({ singleTenant: 'true', showMarketing: 'true' })
          .showMarketing,
      ).toBe(true)
    })

    it('disables marketing in multi-tenant mode when set to "false"', () => {
      expect(
        resolveTenantConfig({ showMarketing: 'false' }).showMarketing,
      ).toBe(false)
    })

    it('treats any non-"true" explicit value as false', () => {
      expect(
        resolveTenantConfig({ singleTenant: 'true', showMarketing: 'yes' })
          .showMarketing,
      ).toBe(false)
    })
  })

  describe('appUrl normalization', () => {
    it('strips trailing slashes', () => {
      expect(resolveTenantConfig({ appUrl: 'https://example.org/' }).appUrl).toBe(
        'https://example.org',
      )
      expect(
        resolveTenantConfig({ appUrl: 'https://example.org///' }).appUrl,
      ).toBe('https://example.org')
    })

    it('trims and falls back to the default when blank', () => {
      expect(resolveTenantConfig({ appUrl: '' }).appUrl).toBe(
        'http://localhost:3000',
      )
      expect(resolveTenantConfig({ appUrl: '   ' }).appUrl).toBe(
        'http://localhost:3000',
      )
    })

    it('leaves a URL with no trailing slash untouched', () => {
      expect(resolveTenantConfig({ appUrl: 'https://example.org' }).appUrl).toBe(
        'https://example.org',
      )
    })
  })

  describe('siteName', () => {
    it('trims whitespace', () => {
      expect(resolveTenantConfig({ siteName: '  Acme Space  ' }).siteName).toBe(
        'Acme Space',
      )
    })

    it('falls back to the default when blank', () => {
      expect(resolveTenantConfig({ siteName: '' }).siteName).toBe('hackerspace.sh')
      expect(resolveTenantConfig({ siteName: '   ' }).siteName).toBe(
        'hackerspace.sh',
      )
    })
  })
})

describe('isMarketingPath', () => {
  it('matches marketing roots and their subpaths', () => {
    expect(isMarketingPath('/')).toBe(true)
    expect(isMarketingPath('/resources')).toBe(true)
    expect(isMarketingPath('/resources/foo')).toBe(true)
    expect(isMarketingPath('/atlas.html')).toBe(true)
  })

  it('rejects app paths', () => {
    expect(isMarketingPath('/dashboard')).toBe(false)
    expect(isMarketingPath('/login')).toBe(false)
  })

  it('does not treat a prefix collision as a subpath', () => {
    expect(isMarketingPath('/resourcesx')).toBe(false)
  })

  it('matches the root exactly without swallowing every path', () => {
    expect(isMarketingPath('/')).toBe(true)
    expect(isMarketingPath('/dashboard')).toBe(false)
  })
})

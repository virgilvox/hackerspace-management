// Which third-party OAuth providers this deployment has wired up in Supabase.
// A provider button that points at an unconfigured provider just dead-ends in
// a Supabase error, so the buttons are opt-in: shown only when the deployer
// explicitly sets the flag. Flags are NEXT_PUBLIC_ because the login page is a
// client component and needs the value in the browser bundle.

export type OAuthProvider = 'github' | 'google'

// Pure core: decide enabled providers from the raw flag strings. Unit-tested.
export function resolveOAuthProviders(flags: {
  github?: string
  google?: string
}): Record<OAuthProvider, boolean> {
  return {
    github: flags.github === 'true',
    google: flags.google === 'true',
  }
}

// Env-reading wrapper. The process.env member expressions are written as
// literals so Next.js statically inlines them into the client bundle.
export function oauthProviders(): Record<OAuthProvider, boolean> {
  return resolveOAuthProviders({
    github: process.env.NEXT_PUBLIC_OAUTH_GITHUB,
    google: process.env.NEXT_PUBLIC_OAUTH_GOOGLE,
  })
}

export function anyOAuthProvider(
  providers: Record<OAuthProvider, boolean>,
): boolean {
  return providers.github || providers.google
}

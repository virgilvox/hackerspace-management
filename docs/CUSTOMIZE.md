# Customizing your instance

How to white-label and extend a self-hosted instance. The rule this app follows: all deployment configuration lives in one place (`lib/tenant.ts`), is resolved by a pure function, and is consumed through a single accessor. Follow that pattern and every customization stays testable and consistent.

This guide assumes you are running your own instance (see [SINGLE_TENANT.md](./SINGLE_TENANT.md)). Most customization applies to any deployment.

## Branding

**Name.** Set `NEXT_PUBLIC_SITE_NAME` to your space's name. It flows through `tenantConfig().siteName` into the UI wordmark and into the page title (the browser tab title is composed from `siteName` in `app/layout.tsx`). It defaults to `hackerspace.sh` when unset. This is a `NEXT_PUBLIC_` value, so set it before `pnpm build`.

**Logo.** There are two separate marks. `public/logo.svg` backs only the browser-tab icons (favicon, Apple touch icon, shortcut icon), wired up in the `icons` block of `app/layout.tsx`; replace that file (keeping the filename) to change what shows in the browser tab. The mark shown inside the app chrome (sidebar, landing, docs, onboarding) is a separate inline SVG in `components/brand-mark.tsx` and must be edited there. Update both if you want a fully white-labeled logo.

**Page title.** The metadata `title` and `description` live in `app/layout.tsx`. The title interpolates `siteName`; edit the surrounding text there if you want a different suffix.

## Base URL and links

Set `NEXT_PUBLIC_APP_URL` to your canonical public URL, with no trailing slash. Every absolute link the app emits (dues emails, form-result links, the `/me` self-serve portal, OAuth redirects) is built from `appBaseUrl()`, which returns `tenantConfig().appUrl`. The resolver strips a trailing slash so callers can safely template `` `${appBaseUrl()}/path` ``.

Never hardcode a domain. When you add a feature that emits an absolute URL, import `appBaseUrl` from `@/lib/tenant` and build the link from it. That is what keeps a single-tenant instance from ever leaking the platform domain.

## The configuration pattern

`lib/tenant.ts` is the single source of truth for deployment configuration. It has three parts, and every flag follows the same shape as the existing ones (which mirror `lib/auth-config.ts`):

1. **`TenantConfig`** is the typed, resolved config the rest of the app consumes.
2. **`resolveTenantConfig(env)`** is a pure function: raw flag strings in, resolved config out, no `process.env` access. All defaulting and precedence lives here, so it is trivially unit-testable.
3. **`tenantConfig()`** is a thin wrapper that reads the `process.env.NEXT_PUBLIC_*` values (written as literals so Next.js inlines them into the client bundle) and passes them to the pure resolver.

### Adding a new deployment-config flag

Say you want a `showRecruitment` flag that toggles the public recruitment page. The steps, in order:

1. **Add a field to `TenantConfig`.** Give it a resolved type and a doc comment:

   ```ts
   export type TenantConfig = {
     // ...existing fields...
     /** Whether the public recruitment page is served. */
     showRecruitment: boolean
   }
   ```

2. **Add the raw input to `TenantEnv`** (all inputs are optional strings, because that is what `process.env` gives you):

   ```ts
   export type TenantEnv = {
     // ...existing fields...
     showRecruitment?: string
   }
   ```

3. **Add the rule to `resolveTenantConfig`.** This is where defaulting and precedence live. Keep it pure:

   ```ts
   return {
     // ...existing fields...
     showRecruitment: env.showRecruitment !== undefined
       ? isTrue(env.showRecruitment)
       : true, // default on
   }
   ```

4. **Unit-test the pure resolver** in `__tests__/tenant.test.ts`, following the style of `__tests__/auth-config.test.ts`: assert the default, assert that exactly `'true'` enables it, and assert that empty or other values are treated as off. Because the resolver takes no `process.env`, the test passes plain objects in.

   ```ts
   it('defaults showRecruitment on and toggles only on "true"', () => {
     expect(resolveTenantConfig({}).showRecruitment).toBe(true)
     expect(resolveTenantConfig({ showRecruitment: 'false' }).showRecruitment).toBe(false)
     expect(resolveTenantConfig({ showRecruitment: '1' }).showRecruitment).toBe(false)
   })
   ```

5. **Read the env var in `tenantConfig()`.** Use a literal `process.env.NEXT_PUBLIC_*` member expression so Next.js can inline it:

   ```ts
   return resolveTenantConfig({
     // ...existing reads...
     showRecruitment: process.env.NEXT_PUBLIC_SHOW_RECRUITMENT,
   })
   ```

6. **Consume it.** In a server or client component, `const { showRecruitment } = tenantConfig()` and branch on it. Document the new variable in `.env.example` and in the env table in `SINGLE_TENANT.md`.

### `NEXT_PUBLIC_` versus server-only

This distinction decides whether a flag can be a security boundary.

- **`NEXT_PUBLIC_` variables are inlined into the client bundle at build time.** They are visible to and forgeable by the browser, and changing one requires a rebuild and redeploy (a running build does not re-read them). Use the prefix only when a client component actually needs the value (for example the signup page, which is a client component). Because the browser can forge them, any rule they express as UX must be re-enforced on the server. The existing flags do exactly this: `createSpace` re-checks `allowSpaceCreation`, `joinSpace` re-checks the open-join rules, and `proxy.ts` re-checks marketing visibility. If your flag gates access to data or an action, add the same server-side check in the relevant server action or route handler. Never treat a `NEXT_PUBLIC_` flag as an authorization boundary on its own.

- **Server-only variables (no `NEXT_PUBLIC_` prefix)** never reach the browser. They are read at request time in server code only (server actions, route handlers, `proxy.ts`). Use these for secrets and for anything the client must not see or influence (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `SECRETS_ENCRYPTION_KEY`, `RESEND_API_KEY`). A server-only flag read in server code is a real trust boundary.

Rule of thumb: if the browser needs to know it to render, it is `NEXT_PUBLIC_` and must be re-enforced server-side. Otherwise keep it server-only.

## Theme and colors

Colors and theme tokens live in `app/globals.css` as CSS custom properties on `:root` (light) and `.dark` (dark). Values are in the `oklch` color space. The brand accent is `--primary` (a green), with matching `--ring`, `--accent`, and `--sidebar-primary`; `--chart-1` through `--chart-5` drive the data visualizations, and there are dedicated `--auth-accent` / `--auth-bg` tokens for the login and signup screens. Change these variables to restyle the whole app; every component reads them through Tailwind.

This project uses Tailwind v4 configured in CSS (`@import 'tailwindcss'` at the top of `app/globals.css`), so there is no `tailwind.config.js` to edit. Extend the theme in `globals.css`.

## Replacing the marketing shell

If you want to keep marketing on but swap in your own landing page, the shell lives under route groups (the group name in parentheses adds no URL segment):

- `app/(landing)/page.tsx` is the landing page (`/`), with `app/(landing)/layout.tsx` and `app/(landing)/landing.css` for its shell and styles.
- `app/(resources)/` holds the resources subsite (`/resources`, `/zine`, `/governance`, `/space-after-dark`, `/proposal-duel`, `/atlas`), with its own `layout.tsx` and `resources.css`.
- `components/landing/` and `components/brand-mark.tsx` are the reusable pieces (hero, showcase, icons, wordmark).

Edit `app/(landing)/page.tsx` to replace the landing content with your own. To hide the whole marketing shell instead, set `NEXT_PUBLIC_SHOW_MARKETING=false` (the default in single-tenant mode); `proxy.ts` then redirects those paths to `/login`. See [SINGLE_TENANT.md](./SINGLE_TENANT.md) for the marketing behavior.

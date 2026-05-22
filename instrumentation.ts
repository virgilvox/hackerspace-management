// Next.js instrumentation. `onRequestError` is the framework-wide hook that
// fires for any error thrown out of a route handler, server component, or
// server action -- so it is the broad net that gives every server action
// error capture without per-action wiring. Swallowed best-effort failures
// (notification fan-outs, cron soft-fails, the Stripe handler that returns 500
// instead of throwing) do NOT reach this hook, so those are captured manually
// at their sites. Inert until SENTRY_DSN is set (the seam no-ops).
import { captureException } from '@/lib/observability/capture'

export async function register(): Promise<void> {
  // No global init: the capture seam is a stateless fetch transport.
}

export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string },
): Promise<void> {
  captureException(err, {
    surface: 'request',
    tags: {
      route: context?.routePath,
      routeType: context?.routeType,
      method: request?.method,
    },
  })
}

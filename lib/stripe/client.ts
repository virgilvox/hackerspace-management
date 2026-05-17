// Server-only. Per-space OWN keys (NOT Connect): a fresh client is created
// per request with that space's decrypted secret key. Never memoize a global
// client and never expose the key to the browser. The API version is pinned
// in lib/stripe-logic so an SDK/API bump is a deliberate, reviewed change.
import Stripe from 'stripe'
import { STRIPE_API_VERSION } from '@/lib/stripe-logic'

export function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion })
}

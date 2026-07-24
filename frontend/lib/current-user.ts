import { cache } from "react";

import { getCurrentUser } from "@/lib/auth-actions";

/**
 * Request-scoped memo of getCurrentUser().
 *
 * /auth/me runs on every navigation via the (home) layout guard, and pages
 * nested under that layout call getCurrentUser() again — two backend round
 * trips for the same answer within one render. React's cache() collapses them.
 *
 * Deliberately not the Next.js Data Cache. That cache keys on the request
 * headers (including Authorization), so per-user entries never collide — but
 * they also stop hitting the moment the JWT rotates, which makes it the wrong
 * tool for per-user reads. cache() is scoped to a single render pass, so it
 * carries no cross-request or cross-user risk at all.
 *
 * Server components only; cache() has no effect in client components.
 */
export const getCachedCurrentUser = cache(getCurrentUser);

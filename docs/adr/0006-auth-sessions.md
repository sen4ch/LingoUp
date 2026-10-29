# ADR-0006: Opaque Sessions in PostgreSQL Instead of JWT

- Status: Accepted
- Date: 2026-10-26

## Solution

- After login, the server generates a 256-bit random token and sends it in the cookie `HttpOnly; SameSite=Lax; Secure` (in production).
- Only the SHA-256 of the token is stored in the database, so a database leak does not provide working sessions.
- The session is immediately revoked by deleting the row (logout, account deletion).
- Web proxies `/api/*` to the API through Next.js rewrites: cookies remain same-origin, CORS is not needed.
- Requesting changes additionally check the `Origin` header.

## Alternatives

JWT with a short lifetime and refresh tokens is more complex to revoke and easier to implement insecurely. Its advantage — verification without a database — is not needed: a session query takes one indexed lookup. When load increases, sessions can be cached in Valkey.

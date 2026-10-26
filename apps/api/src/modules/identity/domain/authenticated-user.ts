/** Identity of the caller, attached to the request by the session guard. */
export interface AuthenticatedUser {
  id: string;
  sessionId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

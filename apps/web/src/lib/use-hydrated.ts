import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * False on the server and during hydration, true afterwards. Components that render
 * session-dependent data must wait for it: a streamed page segment can hydrate after the
 * user query has already resolved, while the server rendered it anonymously.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

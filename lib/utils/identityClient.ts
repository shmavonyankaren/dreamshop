const pending = new Map<string, Promise<void>>();
export function recoverAuthenticatedIdentity(session: string): Promise<void> {
  const existing = pending.get(session);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch("/api/identity/sync", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("Your account could not be synchronized. Retry synchronization to recover it.");
    const result = await response.json();
    if (result?.synchronized !== true) throw new Error("Account recovery was not confirmed. Please retry synchronization.");
  })().finally(() => pending.delete(session));
  pending.set(session, request);
  return request;
}

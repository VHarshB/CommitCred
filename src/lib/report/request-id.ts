const storageKey = "commitcred.smart.request.v1";
let pending: { fingerprint: string; id: string } | null = null;

export function pendingSmartRequest(fingerprint: string) {
  try {
    if (!pending) {
      const previous = sessionStorage.getItem(storageKey);
      if (previous) {
        const value = JSON.parse(previous);
        if (typeof value?.fingerprint === "string" && /^[a-z0-9-]{36}$/i.test(value?.id)) pending = value;
      }
    }
  } catch { /* The current tab can keep the key in memory. */ }
  return pending?.fingerprint === fingerprint ? pending.id : null;
}

export function smartRequestId(fingerprint: string) {
  const id = pendingSmartRequest(fingerprint);
  if (id) return id;
  pending = { fingerprint, id: crypto.randomUUID() };
  try { sessionStorage.setItem(storageKey, JSON.stringify(pending)); } catch { /* Storage is optional. */ }
  return pending.id;
}

export function clearSmartRequest() {
  pending = null;
  try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
}

// mock-kv.mjs
// Minimal in-memory stand-in for a Workers KV namespace binding: only get()
// and put() with the standard signature, no expiry enforcement (tests only
// check the accounting, not real time-based expiry).

export function createMockKv() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    _store: store,
  };
}

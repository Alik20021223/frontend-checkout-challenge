import { readStorage, writeStorage } from './storage';

type StoredKey = { key: string; body: string };

const storageKey = (scope: string) => `idempotency:${scope}`;

// Ключ живёт, пока тело запроса не изменилось: повтор после обрыва связи попадает
// в тот же ресурс, а изменённые данные автоматически получают новый ключ.
export function idempotencyKey(scope: string, body: unknown) {
  const fingerprint = JSON.stringify(body);
  const stored = readStorage<StoredKey>(storageKey(scope));
  if (stored?.body === fingerprint) return stored.key;
  const key = crypto.randomUUID();
  writeStorage(storageKey(scope), { key, body: fingerprint });
  return key;
}

export function releaseIdempotencyKey(scope: string) {
  writeStorage(storageKey(scope), null);
}

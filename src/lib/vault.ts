import { get, set, del } from 'idb-keyval';

export interface PrivateOffer { secret: Uint8Array; salt: Uint8Array; amount: bigint }
export interface CipherEnvelope { version: 1; salt: number[]; iv: number[]; ciphertext: number[] }
const encoder = new TextEncoder();
const codec = {
  stringify: (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? { $bigint: v.toString() } : v instanceof Uint8Array ? { $bytes: Array.from(v) } : v),
  parse: (value: string) => JSON.parse(value, (_, v) => v && typeof v === 'object' && '$bigint' in v ? BigInt(v.$bigint) : v && typeof v === 'object' && '$bytes' in v ? new Uint8Array(v.$bytes) : v),
};
async function keyFor(password: string, salt: Uint8Array<ArrayBuffer>) {
  if (password.length < 16) throw new Error('Your vault passphrase needs at least 16 characters.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encrypt(value: unknown, password: string): Promise<CipherEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(codec.stringify(value)));
  return { version: 1, salt: [...salt], iv: [...iv], ciphertext: [...new Uint8Array(ciphertext)] };
}
export async function decrypt<T>(envelope: CipherEnvelope, password: string): Promise<T> {
  if (envelope.version !== 1) throw new Error('Unsupported vault format');
  const key = await keyFor(password, new Uint8Array(envelope.salt));
  const value = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(envelope.iv) }, key, new Uint8Array(envelope.ciphertext));
  return codec.parse(new TextDecoder().decode(value)) as T;
}
export const newOffer = (amount: bigint): PrivateOffer => ({ secret: crypto.getRandomValues(new Uint8Array(32)), salt: crypto.getRandomValues(new Uint8Array(32)), amount });
export function replaceOffer(offer: PrivateOffer, amount: bigint, alreadySealed: boolean): PrivateOffer {
  if (alreadySealed) throw new Error('A sealed offer cannot be replaced.');
  return { secret: offer.secret, salt: crypto.getRandomValues(new Uint8Array(32)), amount };
}
export const vaultKey = (network: string, fingerprint: string, room: string) => `roda:v1:${network}:${fingerprint}:${room}`;
export async function saveOffer(scope: string, offer: PrivateOffer, password: string) { await set(scope, await encrypt(offer, password)); }
export async function loadOffer(scope: string, password: string) {
  const saved = await get<CipherEnvelope>(scope);
  return saved ? decrypt<PrivateOffer>(saved, password) : null;
}
export async function hasOffer(scope: string) { return Boolean(await get(scope)); }
export async function removeOffer(scope: string) { await del(scope); }
export async function exportOffer(scope: string) {
  const envelope = await get<CipherEnvelope>(scope);
  if (!envelope) throw new Error('No vault to export');
  return JSON.stringify({ format: 'roda-private-backup-v1', scope, envelope });
}
export async function importOffer(scope: string, text: string, password: string) {
  if (text.length > 100000) throw new Error('Invalid vault backup');
  const backup = JSON.parse(text);
  if (backup.format !== 'roda-private-backup-v1' || backup.scope !== scope) throw new Error('This vault backup belongs to a different wallet, room, or network');
  const offer = await decrypt<PrivateOffer>(backup.envelope, password);
  if (!(offer.secret instanceof Uint8Array) || offer.secret.length !== 32 || !(offer.salt instanceof Uint8Array) || offer.salt.length !== 32 || typeof offer.amount !== 'bigint') throw new Error('Invalid vault backup');
  if (await hasOffer(scope)) throw new Error('An existing vault cannot be overwritten by import');
  await set(scope, backup.envelope);
  return offer;
}
export function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

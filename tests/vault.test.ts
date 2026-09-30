import { beforeEach, describe, expect, it, vi } from 'vitest';
const records = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({ get: (key: string) => Promise.resolve(records.get(key)), set: (key: string, value: unknown) => { records.set(key, value); return Promise.resolve(); }, del: (key: string) => { records.delete(key); return Promise.resolve(); } }));
import { encrypt, decrypt, newOffer, replaceOffer, saveOffer, loadOffer, vaultKey, exportOffer, importOffer } from '../src/lib/vault';
const password = 'A very-good Vault! 927';
beforeEach(() => records.clear());
describe('private local vault', () => {
  it('round trips private state without plaintext in storage', async () => {
    const offer = newOffer(435099n); await saveOffer('test', offer, password);
    expect(JSON.stringify(records.get('test'))).not.toContain('435099');
    expect(await loadOffer('test', password)).toEqual(offer);
  });
  it('a wrong password cannot overwrite an existing vault', async () => {
    const offer = newOffer(420000n); await saveOffer('test', offer, password);
    const before = records.get('test'); await expect(loadOffer('test', 'Another incorrect passphrase 41!')).rejects.toThrow();
    expect(records.get('test')).toBe(before);
  });
  it('authenticated ciphertext rejects tampering', async () => {
    const encrypted = await encrypt(newOffer(430000n), password); encrypted.ciphertext[0] ^= 1;
    await expect(decrypt(encrypted, password)).rejects.toThrow();
  });
  it('rotates the blinding salt while preserving worker ownership', () => {
    const old = newOffer(420000n); const next = replaceOffer(old, 430000n, false);
    expect(next.secret).toEqual(old.secret); expect(next.salt).not.toEqual(old.salt); expect(next.amount).toBe(430000n);
  });
  it('does not let a user replace a sealed offer', () => { expect(() => replaceOffer(newOffer(420000n), 430000n, true)).toThrow(); });
  it('isolates wallets and networks', () => {
    expect(vaultKey('preview', 'a', 'solar')).not.toBe(vaultKey('preprod', 'a', 'solar'));
    expect(vaultKey('preview', 'a', 'solar')).not.toBe(vaultKey('preview', 'b', 'solar'));
  });
  it('restores an encrypted backup only into its correct empty scope', async () => {
    const offer = newOffer(420000n); await saveOffer('test', offer, password); const backup = await exportOffer('test');
    await expect(importOffer('other', backup, password)).rejects.toThrow('different wallet');
    await expect(importOffer('test', backup, password)).rejects.toThrow('overwritten');
    records.clear(); expect(await importOffer('test', backup, password)).toEqual(offer);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { discoverWallets, WalletController, friendlyError, type WalletChoice } from '../src/lib/wallet';
const firstId = '67ff1a4a-32a9-4b1a-91c2-84244c859615';
const otherId = '77ff1a4a-32a9-4b1a-91c2-84244c859615';
function provider(name = '1AM', apiVersion = '4.0.1') {
  return { name, rdns: name === '1AM' ? 'xyz.1am.wallet' : 'org.wallet.other', apiVersion, icon: '',
    connect: vi.fn(async (networkId: string) => ({ getConfiguration: async () => ({ networkId }),
      getShieldedAddresses: async () => ({ shieldedCoinPublicKey: 'a'.repeat(64), shieldedEncryptionPublicKey: 'b'.repeat(64) }) })) };
}
describe('wallet discovery and sessions', () => {
  it('discovers UUID keyed providers, preferring 1AM', () => {
    const wallets = discoverWallets({ [otherId]: provider('Other'), [firstId]: provider() });
    expect(wallets.map(w => w.api.name)).toEqual(['1AM', 'Other']);
  });
  it('rejects old APIs and non-UUID injection keys', () => {
    expect(discoverWallets({ lace: provider(), [firstId]: provider('1AM', '3.0.0'), [otherId]: { name: 'broken' } })).toEqual([]);
  });
  it('handles an absent wallet without crashing', () => { expect(discoverWallets(null)).toEqual([]); });
  it('connects to the requested network and scopes worker identity', async () => {
    const controller = new WalletController(); const api = provider();
    const session = await controller.connect({ id: firstId, api } as unknown as WalletChoice);
    expect(api.connect).toHaveBeenCalledWith('preview'); expect(session.fingerprint).toHaveLength(64);
  });
  it('network switching resets the session', async () => {
    const controller = new WalletController();
    await controller.connect({ id: firstId, api: provider() } as unknown as WalletChoice);
    controller.switchNetwork('preprod'); expect(controller.session).toBeNull(); expect(controller.network).toBe('preprod');
  });
  it('ignores a late connection after disconnect', async () => {
    const controller = new WalletController();
    const pending = controller.connect({ id: firstId, api: provider() } as unknown as WalletChoice);
    controller.disconnect(); await expect(pending).rejects.toThrow('STALE_SESSION'); expect(controller.session).toBeNull();
  });
  it('rejects an incorrectly connected wallet network', async () => {
    const controller = new WalletController(); controller.switchNetwork('preprod');
    const api = provider(); api.connect = vi.fn(async () => ({ getConfiguration: async () => ({ networkId: 'preview' }), getShieldedAddresses: async () => ({ shieldedCoinPublicKey: '', shieldedEncryptionPublicKey: '' }) }));
    await expect(controller.connect({ id: firstId, api } as unknown as WalletChoice)).rejects.toThrow('NETWORK_MISMATCH');
  });
  it.each([['insufficient DUST', 'DUST'], ['PermissionRejected', 'declined'], ['prover failure', 'proving'], ['indexer unavailable', 'confirm']])('classifies %s without leaking diagnostics', (error, text) => { expect(friendlyError(new Error(error))).toContain(text); });
});

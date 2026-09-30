import type { InitialAPI, ConnectedAPI, Configuration } from '@midnight-ntwrk/dapp-connector-api';

export type Network = 'preview' | 'preprod';
export interface WalletChoice { id: string; api: InitialAPI }
export interface WalletSession {
  api: ConnectedAPI; config: Configuration; name: string; network: Network;
  coinPublicKey: string; encryptionPublicKey: string; fingerprint: string;
}
const ONE_AM_NAME = /(?:^|\s)1\s*am(?:\s+wallet)?(?:$|\s)/i;
const ONE_AM_RDNS = /(?:^|[._-])(?:1am|oneam)(?:[._-]|$)/i;
export const is1AM = (wallet: WalletChoice) =>
  wallet.api.apiVersion.split('.')[0] === '4'
  && (ONE_AM_NAME.test(wallet.api.name.trim()) || ONE_AM_RDNS.test(wallet.api.rdns ?? ''));
export function discoverWallets(injected: unknown = window.midnight): WalletChoice[] {
  if (!injected || typeof injected !== 'object') return [];
  return Object.entries(injected).filter(([id, api]) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    && api && typeof api.name === 'string' && typeof api.rdns === 'string'
    && typeof api.apiVersion === 'string' && typeof api.connect === 'function'
    && is1AM({ id, api: api as InitialAPI }),
  ).map(([id, api]) => ({ id, api: api as InitialAPI }));
}
export async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
export class WalletController {
  private generation = 0;
  session: WalletSession | null = null;
  network: Network = 'preview';
  disconnect() { this.generation += 1; this.session = null; }
  switchNetwork(network: Network) { this.disconnect(); this.network = network; }
  async connect(choice: WalletChoice): Promise<WalletSession> {
    const generation = ++this.generation;
    const network = this.network;
    this.session = null;
    const api = await choice.api.connect(network);
    const config = await api.getConfiguration();
    if (config.networkId !== network) throw new Error('NETWORK_MISMATCH');
    const addresses = await api.getShieldedAddresses();
    const session: WalletSession = {
      api, config, name: choice.api.name, network,
      coinPublicKey: addresses.shieldedCoinPublicKey,
      encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
      fingerprint: await digest(`${network}:${addresses.shieldedCoinPublicKey}`),
    };
    if (generation !== this.generation) throw new Error('STALE_SESSION');
    this.session = session;
    return session;
  }
}
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied|cancel|PermissionRejected/i.test(message)) return 'Request declined in your wallet. Your local offer is safe; you can try again.';
  if (/dust|balance|funds/i.test(message)) return 'Your wallet needs available DUST to cover network fees. Fund it on the selected test network, then retry.';
  if (/STALE_SESSION|NETWORK_MISMATCH|network/i.test(message)) return 'The wallet session changed or uses a different network. Reconnect on the selected network.';
  if (/proof|prover|zkir/i.test(message)) return 'The wallet proving service could not complete the proof. Check 1AM’s prover settings and try again.';
  if (/indexer|finaliz|timeout|fetch|socket/i.test(message)) return 'The network could not confirm the result yet. Check any saved pending transaction before retrying.';
  if (/decrypt|OperationError|password|vault/i.test(message)) return 'The vault could not be unlocked. Check your passphrase; existing data has not been replaced.';
  if (/closed|deadline|period|Opening/i.test(message)) return 'This action is outside the commission’s on-chain time window.';
  if (/already|consumed/i.test(message)) return 'This offer has already been used. Refresh its on-chain state before continuing.';
  return 'This action could not be completed. Your saved offer is retained. Check the wallet and network, then retry.';
}

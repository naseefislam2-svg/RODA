import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, RefreshCw, Wallet } from 'lucide-react';
import { discoverWallets, is1AM, type WalletChoice, type WalletSession } from '../lib/wallet';
import { Modal } from './Modal';
export function WalletModal({ onClose, onConnect, session, disconnect, error }: {
  onClose: () => void; onConnect: (wallet: WalletChoice) => Promise<void>;
  session: WalletSession | null; disconnect: () => void; error: string;
}) {
  const [wallets, setWallets] = useState(discoverWallets);
  const [pending, setPending] = useState(false);
  useEffect(() => { const timer = setInterval(() => setWallets(discoverWallets()), 1500); return () => clearInterval(timer); }, []);
  const duplicates = wallets.some((wallet, index) => wallets.findIndex(w => w.api.rdns === wallet.api.rdns) !== index);
  return <Modal title={session ? 'You’re connected.' : 'A wallet. Your own workspace.'} onClose={onClose} busy={pending}>
    <p className="muted">Connect 1AM to create a worker contract in your browser. You approve every transaction in your wallet.</p>
    {session ? <div className="wallet-connected"><Check/><div><strong>{session.name}</strong><span>{session.network} · Session connected</span></div><button className="text-button" onClick={disconnect}>Disconnect</button></div> : <>
      {duplicates && <p role="alert" className="error">More than one provider uses the same wallet identity. Verify your installed extensions before connecting.</p>}
      {wallets.map(wallet => <button key={wallet.id} className="wallet-option" disabled={pending || duplicates} onClick={async () => { setPending(true); try { await onConnect(wallet); } finally { setPending(false); } }}>
        <span className="wallet-symbol"><Wallet/></span><span><strong>{wallet.api.name}</strong><small>{wallet.api.rdns}</small></span>
        {is1AM(wallet) && <span className="pill">Preferred</span>}<ArrowUpRight size={20}/>
      </button>)}
      {!wallets.length && <div className="empty-wallet"><Wallet size={32}/><h3>No compatible wallet found yet.</h3><p>Install 1AM in this browser, enable its Midnight connection, and refresh the wallet list.</p><a className="button dark" href="https://1am.xyz/" target="_blank" rel="noreferrer">Get 1AM <ArrowUpRight size={16}/></a><button className="text-button" onClick={() => setWallets(discoverWallets())}><RefreshCw size={14}/> Check again</button></div>}
      {pending && <p role="status" className="notice">Waiting for your approval in the wallet…</p>}
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    <p className="fine-print">Disconnecting ends this app’s session. To revoke permission permanently, remove RODA in your wallet settings. No seed phrase is ever requested.</p>
  </Modal>;
}

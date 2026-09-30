import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, CheckCheck, Copy, Download, Eye, Fingerprint, Globe2, LockKeyhole, ShieldCheck, Sparkles, Upload, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { type Room, money, parseAmount, deadlineLabel } from '../data/rooms';
import { type WalletSession, friendlyError } from '../lib/wallet';
import { download, exportOffer, importOffer, loadOffer, newOffer, replaceOffer, saveOffer, vaultKey, type PrivateOffer } from '../lib/vault';
import { readDeployment, readPending, explorerUrl, shortHash, type Action, type Deployment } from '../lib/receipts';
import { getGuidance, localGuidance, publishReceipt, type Guidance } from '../lib/api';
import type { Stage } from '../lib/midnight';
import { Modal } from './Modal';

const phases: { id: Stage; name: string; detail: string }[] = [
  { id: 'preparing', name: 'Prepare locally', detail: 'Loading your private offer and public policy' },
  { id: 'proving', name: 'Generate proof', detail: 'Your wallet’s chosen prover checks the circuit' },
  { id: 'approving', name: 'Approve in 1AM', detail: 'Review the transaction and DUST fee in your wallet' },
  { id: 'finalizing', name: 'Confirm on Midnight', detail: 'Waiting for the indexer to confirm finalization' },
  { id: 'done', name: 'Receipt is ready', detail: 'A real finalized transaction, saved on this device' },
];
export function BidWorkspace({ room, session, onClose, onConnect, onUpdate }: {
  room: Room; session: WalletSession | null; onClose: () => void; onConnect: () => void; onUpdate: () => void;
}) {
  const scope = session ? vaultKey(session.network, session.fingerprint, room.id) : '';
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [offer, setOffer] = useState<PrivateOffer | null>(null);
  const [record, setRecord] = useState<Deployment | null>(() => scope ? readDeployment(scope) : null);
  const [pending, setPending] = useState(() => scope ? readPending(scope) : null);
  const [reviewed, setReviewed] = useState(false);
  const [openReview, setOpenReview] = useState(false);
  const [withdrawReview, setWithdrawReview] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [guidance, setGuidance] = useState<Guidance>(() => localGuidance(room));
  const [thinking, setThinking] = useState(false);
  const [copied, setCopied] = useState('');
  const [publicShared, setPublicShared] = useState(false);
  const lock = useRef(false);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const isClosed = clock >= Date.parse(room.deadline);
  const savedPrice = offer ? `${offer.amount / 100n}.${(offer.amount % 100n).toString().padStart(2, '0')}` : '';
  const edited = Boolean(offer && amount !== savedPrice);
  useEffect(() => {
    if (!busy) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [busy]);

  async function save() {
    if (!session || !scope || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      // Use the SDK's password policy before any deployment or secret is created.
      const { validatePassword } = await import('@midnight-ntwrk/midnight-js-utils');
      validatePassword(password);
      const old = await loadOffer(scope, password);
      if (old && !offer) { setOffer(old); setAmount(`${old.amount / 100n}.${(old.amount % 100n).toString().padStart(2, '0')}`); setNotice('Your saved offer is unlocked on this device.'); return; }
      if (record?.phase && record.phase !== 'ready') throw new Error('A sealed offer cannot be edited');
      const cents = parseAmount(amount, room);
      const next = old ? replaceOffer(old, cents, false) : newOffer(cents);
      await saveOffer(scope, next, password);
      setOffer(next); setAmount(`${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`);
      setNotice('Encrypted and saved on this device. Export a backup before deploying.');
      setReviewed(false); onUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(/price|passphrase|public price|Password must|password must|characters|sequential|repeated|sealed offer/.test(message) ? message : friendlyError(err));
    } finally { lock.current = false; setBusy(false); }
  }
  async function transact(action: Action | 'recover') {
    if (!session || !offer || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice(''); setStage('preparing');
    try {
      const { execute, recover } = await import('../lib/midnight');
      const operation = { session, room, scope, offer, password, stage: setStage };
      const result = await (action === 'recover' ? recover(operation) : execute(operation, action));
      setRecord(result); setPending(null); setPublicShared(false); onUpdate();
    } catch (err) { setError(friendlyError(err)); setStage(null); setPending(readPending(scope)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); } catch { setNotice('Select and copy the full value below.'); }
  }
  async function ask(question: 'brief' | 'privacy' | 'checklist') {
    setThinking(true); setGuidance(await getGuidance(room, question)); setThinking(false);
  }
  return <Modal title={room.title} onClose={onClose} busy={busy} wide>
    <div className="workspace-meta"><span>{room.organization}</span><span>{money(room.minimum)}–{money(room.maximum)}</span><span>Closes {deadlineLabel(room.deadline)}</span><span className="pill">Sample commission</span></div>
    <div className="workspace-grid"><div className="workspace-main">
      <section className="step-block"><div className="step-heading"><span className="step-number">01</span><div><h3>Your offer, in your space.</h3><p>The exact price stays private while bidding is open.</p></div><LockKeyhole size={19}/></div>
        {!session && <button className="button dark full" onClick={onConnect}><Wallet size={17}/> Connect 1AM to open your workspace <ArrowRight size={16}/></button>}
        <label className="field-label" htmlFor="offer-amount">Your price <span>BRL</span></label>
        <div className="price-input"><span>R$</span><input id="offer-amount" inputMode="decimal" autoComplete="off" placeholder="Your considered offer" value={amount} onChange={e => { setAmount(e.target.value); setReviewed(false); }} disabled={busy || (record !== null && record.phase !== 'ready')}/><LockKeyhole size={17}/></div>
        <p className="field-hint">Public price band: {money(room.minimum)}–{money(room.maximum)}. This is a proposal, with no escrow or payment transfer.</p>
        <label className="field-label" htmlFor="vault-password">Local vault passphrase</label>
        <input id="vault-password" className="input" type="password" autoComplete="off" value={password} disabled={busy || Boolean(offer)} onChange={e => setPassword(e.target.value)} placeholder="A strong passphrase you’ll keep safe"/>
        <p className="field-hint">16+ characters; use three of uppercase, lowercase, numbers, and symbols. Avoid sequences. It never leaves this browser.</p>
        <div className="action-row"><button className="button dark" disabled={!session || busy || !password || (Boolean(offer) && !edited)} onClick={() => void save()}><LockKeyhole size={16}/>{offer ? 'Save updated offer' : 'Save / unlock local offer'}</button>
          {offer && <button className="text-button" disabled={busy} onClick={async () => { try { download(`roda-${room.id}-private-backup.json`, await exportOffer(scope)); } catch { setError('Could not export the encrypted backup.'); } }}><Download size={15}/> Backup</button>}
          {!offer && session && <label className="text-button import-label"><Upload size={15}/> Restore<input type="file" accept="application/json" disabled={busy || !password} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { const restored = await importOffer(scope, await file.text(), password); setOffer(restored); setAmount(`${restored.amount / 100n}.${(restored.amount % 100n).toString().padStart(2, '0')}`); setNotice('Encrypted backup restored.'); } catch (err) { setError(friendlyError(err)); } }}/></label>}
        </div>
        {offer && <div className="local-indicator"><span className="status-dot"/> Encrypted on this device <span>·</span> AES-256-GCM</div>}
      </section>

      <section className="step-block"><div className="step-heading"><span className="step-number">02</span><div><h3>A clear line around your privacy.</h3><p>Know what crosses it before you sign.</p></div><ShieldCheck size={20}/></div>
        <div className="boundary"><div><span className="eyebrow"><LockKeyhole size={13}/> STAYS PRIVATE</span><strong>Your exact offer</strong><span>Your worker secret</span><span>Your random blinding salt</span></div><div className="boundary-line"><ShieldCheck size={19}/></div><div><span className="eyebrow"><Globe2 size={13}/> BECOMES PUBLIC</span><strong>Proof of a valid offer</strong><span>Salted commitment + replay tag</span><span>Contract, time, and transaction</span></div></div>
        <p className="field-hint">Proof generation uses the environment configured in your wallet. A remote prover can see witness data. Use a local or trusted prover. This worker contract does not enforce one person per room.</p>
        <label className="check-label"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e => setReviewed(e.target.checked)}/><span>I understand the public metadata and trust my wallet’s proving environment.</span></label>
      </section>

      <section className="step-block"><div className="step-heading"><span className="step-number">03</span><div><h3>{record ? 'Your worker contract.' : 'Own your place in the room.'}</h3><p>{record ? 'Deployed by you. Retained for this wallet and network.' : 'Your wallet creates the contract. RODA never deploys on your behalf.'}</p></div><Fingerprint size={21}/></div>
        {record && <div className="contract-receipt"><span className="eyebrow">WORKER CONTRACT · {record.receipt.network}</span><div className="hash-row"><code>{record.receipt.contractAddress}</code><button className="icon-button" aria-label="Copy contract address" onClick={() => void copy(record.receipt.contractAddress, 'address')}>{copied === 'address' ? <Check size={16}/> : <Copy size={16}/>}</button></div><span className="eyebrow">DEPLOYMENT TRANSACTION HASH</span><div className="hash-row"><code>{record.receipt.txHash}</code><button className="icon-button" aria-label="Copy deployment hash" onClick={() => void copy(record.receipt.txHash, 'hash')}>{copied === 'hash' ? <Check size={16}/> : <Copy size={16}/>}</button></div><a href={explorerUrl(record.receipt)} target="_blank" rel="noreferrer" className="text-button">View deployment <ArrowUpRight size={14}/></a><span className="receipt-status"><CheckCheck size={14}/> Block {record.receipt.blockHeight} · {record.phase}</span></div>}
        {pending ? <div className="notice"><strong>A submitted transaction needs confirmation.</strong><p>Transaction ID: <code>{shortHash(pending.txId)}</code>. Check its finalization before creating another transaction.</p><button className="button dark" disabled={busy || !offer} onClick={() => void transact('recover')}>Recover transaction <ArrowRight size={16}/></button></div>
          : !record ? <button className="button orange full" disabled={!offer || edited || !reviewed || busy || isClosed} onClick={() => void transact('deploy')}>Deploy my worker contract <ArrowUpRight size={18}/></button>
          : record.phase === 'ready' ? <button className="button orange full" disabled={!offer || edited || !reviewed || busy || isClosed} onClick={() => void transact('seal')}>Prove & seal my offer <LockKeyhole size={17}/></button>
          : record.phase === 'sealed' ? <>
            <div className="success-note"><ShieldCheck size={19}/><div><strong>Your offer is sealed.</strong><p>{isClosed ? 'The opening window is available. You control whether to reveal.' : `Your amount stays hidden. Opening begins ${deadlineLabel(room.deadline)}.`}</p></div></div>
            {isClosed ? <><label className="check-label"><input type="checkbox" checked={openReview} onChange={e => setOpenReview(e.target.checked)} disabled={busy}/><span>I choose to permanently publish my exact offer amount on Midnight.</span></label><button className="button dark" disabled={!offer || !openReview || !reviewed || busy} onClick={() => void transact('open')}><Eye size={16}/> Open and disclose my offer</button></>
              : <><label className="check-label"><input type="checkbox" checked={withdrawReview} onChange={e => setWithdrawReview(e.target.checked)} disabled={busy}/><span>Withdraw permanently. This worker contract cannot bid again.</span></label><button className="text-button" disabled={!offer || !withdrawReview || busy || !reviewed} onClick={() => void transact('withdraw')}>Withdraw sealed offer</button></>}
          </> : <div className="success-note"><CheckCheck/><p>{record.phase === 'opened' ? 'Your offer is open. Its amount is now public on Midnight.' : 'This offer has been withdrawn. Its amount remains hidden.'}</p></div>}
        {isClosed && (!record || record.phase === 'ready') && <p className="notice">This commission’s bidding window has closed.</p>}
        {record && <div className="receipt-actions"><button className="text-button" onClick={() => download('roda-public-receipt.json', JSON.stringify(record, null, 2))}><Download size={14}/> Public receipt</button><button className="text-button" disabled={publicShared || busy} onClick={async () => { try { const ok = await publishReceipt(record.lastReceipt); setPublicShared(ok); setNotice(ok ? 'Public receipt shared. The API labels it as client-reported.' : 'Public sharing is unavailable. Your finalized receipt is still saved locally.'); } catch { setNotice('Public sharing is unavailable. Your local receipt is safe.'); } }}>{publicShared ? 'Public receipt shared' : 'Share public receipt'}</button></div>}
      </section>
      {stage && <div className="proof-progress" role="status" aria-live="polite">{phases.map((phase, index) => { const current = phases.findIndex(p => p.id === stage); return <div key={phase.id} className={index <= current ? 'reached' : ''}><motion.span animate={index === current && busy ? { opacity: [.4, 1, .4] } : { opacity: 1 }} transition={{ duration: 1.5, repeat: Infinity }}>{index < current || stage === 'done' ? <Check size={14}/> : index + 1}</motion.span><span><strong>{phase.name}</strong>{index === current && <small>{phase.detail}</small>}</span></div>; })}</div>}
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    </div>
    <aside className="workspace-aside"><span className="eyebrow"><Sparkles size={14}/> THE BRIEF, MADE CLEAR</span><h3>A little clarity.<br/>A better starting point.</h3><p>Explore the public brief without sharing a single detail of your offer.</p><div className="assistant-options"><button onClick={() => void ask('brief')} disabled={thinking}>Explain the brief <ArrowUpRight size={14}/></button><button onClick={() => void ask('privacy')} disabled={thinking}>What stays private? <ArrowUpRight size={14}/></button><button onClick={() => void ask('checklist')} disabled={thinking}>My bidding checklist <ArrowUpRight size={14}/></button></div><div className="guidance-answer" aria-live="polite">{thinking ? <p>Reading the public brief…</p> : <><span className="pill">{guidance.source === 'gemini' ? 'Gemini · public context only' : 'Local guide · no AI request'}</span><p>{guidance.summary}</p><ol>{guidance.steps.map(step => <li key={step}>{step}</li>)}</ol><p className="fine-print">{guidance.privacy_note}</p></>}</div><div className="aside-note"><Fingerprint size={24}/><strong>Your effort has value.</strong><p>You set your price without watching anyone else’s. That’s the point.</p></div></aside>
    </div>
  </Modal>;
}

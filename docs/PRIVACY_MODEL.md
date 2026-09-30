# Privacy model

RODA separates three domains: the browser vault, the wallet/prover boundary, and public infrastructure.

| An observer can learn | An observer cannot learn from RODA’s public state |
| --- | --- |
| Public room identifier, price floor and ceiling, and deadline | The sealed offer amount |
| Worker contract address and transaction timing | The worker secret or blinding salt |
| That an offer met the public range when `seal` succeeded | A bidder’s wallet address from RODA’s API |
| Salted offer commitment and per-contract replay nullifier | Raw credentials, identity documents, or proposal files |
| Whether the offer was withdrawn or voluntarily opened | The local vault passphrase or encrypted plaintext |
| Opened amount after the bidder explicitly calls `open` | Private data inferred from Gemini, because it receives only a room ID and preset question |

## Trust boundaries

- **Browser vault:** AES-256-GCM with PBKDF2 (310,000 SHA-256 iterations). IndexedDB contains ciphertext. Losing both the passphrase and backup loses access.
- **1AM wallet:** Supplies addresses, balances and transaction approval. RODA requests the minimum connector surface needed for contract calls.
- **Prover selected by the wallet:** May observe witness material. Users should configure a local or trusted prover. RODA’s application API is never a proving endpoint.
- **Midnight public state:** Publishes the contract state and finalized transaction metadata described above.
- **Render API:** Accepts only fixed public room IDs, fixed assistant questions, and a strict public-receipt schema. Extra fields are rejected without echoing their values.
- **Gemini:** Receives a normalized public commission excerpt. No free text, wallet address, offer, secret, raw document, or credential is accepted by the composition endpoint. Only a SHA-256 hash of the normalized prompt is stored.

## `disclose()` justification

| Disclosure | Reason |
| --- | --- |
| Room ID, floor, ceiling, deadline | These are the commission’s public rules and must bind each worker contract. |
| Owner hash | A one-way ownership commitment lets later circuits authenticate the same local secret. |
| Two range predicates | The verifier must learn that the hidden offer is at least the floor and at most the ceiling; it does not learn the amount. |
| Nullifier | The replay tag prevents a second seal within the worker contract without revealing the secret. |
| Offer commitment | The salted commitment binds the hidden amount for later opening. |
| Exact amount in `open` | This is an explicit, irreversible, post-deadline action with a separate UI confirmation. |

## Limitations

The MVP provides no escrow, token transfer, automatic winner selection, issuer verification, cross-contract unique-human enforcement, or encrypted cloud backup. Client-reported receipts are labelled as such and excluded from the independently verified metric. The current API contains no indexer verification worker, so that verified metric remains zero.

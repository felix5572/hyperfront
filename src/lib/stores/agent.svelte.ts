import { PrivateKeySigner } from '@nktkas/hyperliquid/signing';

let privateKey = $state<`0x${string}` | null>(null);
let approved = $state(false);
// Master account the agent was approved for. Orders signed by the agent always
// execute on this account, regardless of which wallet is currently connected.
let masterAddress = $state<`0x${string}` | null>(null);
// On-chain expiry (ms) baked into the agent name via "valid_until".
let expiresAt = $state<number | null>(null);
let modalOpen = $state(false);

const STORAGE_KEY = 'hf_agent_key';
const STORAGE_APPROVED_KEY = 'hf_agent_approved';
const STORAGE_MASTER_KEY = 'hf_agent_master';
const STORAGE_EXPIRES_KEY = 'hf_agent_expires';

// Hydrate from localStorage in browser context.
// - never-approved key: keep it so a retry re-approves the same address.
// - valid approval (master + future expiry recorded): restore fully.
// - approved but expired/legacy format: discard the key entirely — a
//   deregistered agent address must not be reused (its nonce state may be
//   pruned; see agent_wallet.md).
if (typeof window !== 'undefined') {
	const storedKey = localStorage.getItem(STORAGE_KEY);
	if (storedKey && /^0x[0-9a-fA-F]{64}$/.test(storedKey)) {
		const wasApproved = localStorage.getItem(STORAGE_APPROVED_KEY) === 'true';
		const storedMaster = localStorage.getItem(STORAGE_MASTER_KEY);
		const storedExpires = Number(localStorage.getItem(STORAGE_EXPIRES_KEY));
		const validApproval =
			wasApproved &&
			storedMaster != null && /^0x[0-9a-fA-F]{40}$/.test(storedMaster) &&
			Number.isFinite(storedExpires) && storedExpires > Date.now();
		if (!wasApproved) {
			privateKey = storedKey as `0x${string}`;
		} else if (validApproval) {
			privateKey = storedKey as `0x${string}`;
			approved = true;
			masterAddress = storedMaster as `0x${string}`;
			expiresAt = storedExpires;
		} else {
			for (const key of [STORAGE_KEY, STORAGE_APPROVED_KEY, STORAGE_MASTER_KEY, STORAGE_EXPIRES_KEY]) {
				localStorage.removeItem(key);
			}
		}
	}
}

const signer = $derived(privateKey ? new PrivateKeySigner(privateKey) : null);
const address = $derived(signer ? (signer.address as `0x${string}`) : null);

function generateKey() {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	const newKey = `0x${Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')}` as `0x${string}`;

	privateKey = newKey;
	approved = false;
	masterAddress = null;
	expiresAt = null;

	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, newKey);
		localStorage.setItem(STORAGE_APPROVED_KEY, 'false');
		localStorage.removeItem(STORAGE_MASTER_KEY);
		localStorage.removeItem(STORAGE_EXPIRES_KEY);
	}
}

/**
 * Reuse an existing un-approved key instead of generating a new one.
 * Retrying an approval (e.g. after a wallet timeout) must re-approve the SAME
 * agent address — generating a fresh key each attempt piles up named agents
 * (max 3 per account) and orphans any approval that landed late.
 */
function ensureKey() {
	if (privateKey && !approved) return;
	generateKey();
}

function markApproved(master: `0x${string}`, approvedUntil: number) {
	approved = true;
	masterAddress = master;
	expiresAt = approvedUntil;
	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_APPROVED_KEY, 'true');
		localStorage.setItem(STORAGE_MASTER_KEY, master);
		localStorage.setItem(STORAGE_EXPIRES_KEY, String(approvedUntil));
	}
}

function clear() {
	privateKey = null;
	approved = false;
	masterAddress = null;
	expiresAt = null;
	if (typeof window !== 'undefined') {
		localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem(STORAGE_APPROVED_KEY);
		localStorage.removeItem(STORAGE_MASTER_KEY);
		localStorage.removeItem(STORAGE_EXPIRES_KEY);
	}
}

/**
 * If the approval has expired, drop the whole agent (key included — a
 * deregistered agent address must not be reused). Returns true if it expired.
 */
function expireIfNeeded(): boolean {
	if (approved && expiresAt != null && Date.now() >= expiresAt) {
		clear();
		return true;
	}
	return false;
}

/**
 * Validate the agent is usable for the currently connected wallet and return
 * its signer. All order/cancel/modify paths MUST go through this — it is the
 * guard against signing for a different account than the one shown in the UI.
 */
function requireSigner(
	connectedAddress: `0x${string}` | null
): { signer: PrivateKeySigner } | { error: string } {
	if (expireIfNeeded()) {
		return { error: 'Agent approval expired (24 h limit) — set it up again' };
	}
	if (!signer || !approved || masterAddress == null || expiresAt == null) {
		return { error: 'Agent wallet not set up' };
	}
	if (!connectedAddress) {
		return { error: 'Connect wallet first' };
	}
	if (masterAddress.toLowerCase() !== connectedAddress.toLowerCase()) {
		return {
			error:
				`Agent was approved for ${masterAddress}, but the connected wallet is ` +
				`${connectedAddress}. Orders would execute on the wrong account — ` +
				`reconnect that wallet or set up the agent again.`
		};
	}
	return { signer };
}

export const agentStore = {
	get signer() {
		return signer;
	},
	get address() {
		return address;
	},
	get approved() {
		return approved;
	},
	get masterAddress() {
		return masterAddress;
	},
	get expiresAt() {
		return expiresAt;
	},
	get modalOpen() {
		return modalOpen;
	},
	set modalOpen(v: boolean) {
		modalOpen = v;
	},
	generateKey,
	ensureKey,
	markApproved,
	expireIfNeeded,
	requireSigner,
	clear
};

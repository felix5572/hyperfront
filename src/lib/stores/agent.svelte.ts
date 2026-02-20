import { PrivateKeySigner } from '@nktkas/hyperliquid/signing';

let privateKey = $state<`0x${string}` | null>(null);
let approved = $state(false);
let modalOpen = $state(false);

const STORAGE_KEY = 'hf_agent_key';
const STORAGE_APPROVED_KEY = 'hf_agent_approved';

// Hydrate from localStorage in browser context
if (typeof window !== 'undefined') {
	const storedKey = localStorage.getItem(STORAGE_KEY);
	if (storedKey && /^0x[0-9a-fA-F]{64}$/.test(storedKey)) {
		privateKey = storedKey as `0x${string}`;
		approved = localStorage.getItem(STORAGE_APPROVED_KEY) === 'true';
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

	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, newKey);
		localStorage.setItem(STORAGE_APPROVED_KEY, 'false');
	}
}

function markApproved() {
	approved = true;
	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_APPROVED_KEY, 'true');
	}
}

function clear() {
	privateKey = null;
	approved = false;
	if (typeof window !== 'undefined') {
		localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem(STORAGE_APPROVED_KEY);
	}
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
	get modalOpen() {
		return modalOpen;
	},
	set modalOpen(v: boolean) {
		modalOpen = v;
	},
	generateKey,
	markApproved,
	clear
};

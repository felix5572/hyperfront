import { PrivateKeySigner } from '@nktkas/hyperliquid/signing';

let privateKey = $state<`0x${string}` | null>(null);
let approved = $state(false);

const signer = $derived(privateKey ? new PrivateKeySigner(privateKey) : null);
const address = $derived(signer ? (signer.address as `0x${string}`) : null);

function generateKey() {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	privateKey = `0x${Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')}` as `0x${string}`;
	approved = false;
}

function markApproved() {
	approved = true;
}

function clear() {
	privateKey = null;
	approved = false;
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
	generateKey,
	markApproved,
	clear
};

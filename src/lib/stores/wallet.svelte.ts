import type { WalletClient, Transport, Chain } from 'viem';
import {
	connectInjectedWallet,
	getConnectedAccounts,
	onAccountsChanged
} from '$lib/wallet/connect';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// Reactive wallet state using Svelte 5 runes
let address = $state<`0x${string}` | null>(null);
let status = $state<ConnectionStatus>('disconnected');
let walletClient = $state<WalletClient<Transport, Chain> | null>(null);
let error = $state<string | null>(null);

// Synchronous lock to prevent concurrent connect() calls (avoids MetaMask -32002 "request already pending")
let connectLock = false;

// Derived
const isConnected = $derived(status === 'connected' && address !== null);

// Connect to injected wallet (MetaMask, Rabby, etc.)
async function connect() {
	if (connectLock) return;
	connectLock = true;
	status = 'connecting';
	error = null;

	try {
		const result = await connectInjectedWallet();
		address = result.address;
		walletClient = result.walletClient;
		status = 'connected';
	} catch (e) {
		status = 'disconnected';
		error = e instanceof Error ? e.message : String(e);
		throw e;
	} finally {
		connectLock = false;
	}
}

// Disconnect (client-side only, doesn't revoke wallet permission)
function disconnect() {
	address = null;
	walletClient = null;
	status = 'disconnected';
	error = null;
}

// Auto-reconnect if wallet was previously connected
async function tryReconnect() {
	const accounts = await getConnectedAccounts();
	if (accounts.length > 0) {
		await connect();
	}
}

// Listen for account changes from wallet
function setupListeners() {
	return onAccountsChanged((accounts) => {
		if (accounts.length === 0) {
			disconnect();
		} else {
			// Re-connect with new account
			connect();
		}
	});
}

export const walletStore = {
	get address() { return address; },
	get status() { return status; },
	get walletClient() { return walletClient; },
	get error() { return error; },
	get isConnected() { return isConnected; },
	connect,
	disconnect,
	tryReconnect,
	setupListeners
};

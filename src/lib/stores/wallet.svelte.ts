import type { WalletClient, Transport } from 'viem';
import {
	connectInjectedWallet,
	connectWalletConnect,
	disconnectWalletConnect,
	reconnectWalletConnect,
	getConnectedAccounts,
	onAccountsChanged,
	onWalletConnectAccountsChanged,
	onWalletConnectDisconnect
} from '$lib/wallet/connect';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type ConnectMethod = 'injected' | 'walletconnect';

// Reactive wallet state using Svelte 5 runes
let address = $state<`0x${string}` | null>(null);
let status = $state<ConnectionStatus>('disconnected');
let walletClient = $state<WalletClient<Transport> | null>(null);
let error = $state<string | null>(null);
let connectedVia = $state<ConnectMethod | null>(null);

// Synchronous lock to prevent concurrent connect() calls (avoids MetaMask -32002 "request already pending")
let connectLock = false;

// Derived
const isConnected = $derived(status === 'connected' && address !== null);

// Connect to wallet
async function connect(method: ConnectMethod = 'injected') {
	if (connectLock) return;
	connectLock = true;
	status = 'connecting';
	error = null;

	try {
		const result = method === 'walletconnect'
			? await connectWalletConnect()
			: await connectInjectedWallet();
		address = result.address;
		walletClient = result.walletClient;
		status = 'connected';
		connectedVia = method;
	} catch (e) {
		status = 'disconnected';
		error = e instanceof Error ? e.message : String(e);
		throw e;
	} finally {
		connectLock = false;
	}
}

// Disconnect (handles both injected and WalletConnect)
async function disconnect() {
	if (connectedVia === 'walletconnect') {
		await disconnectWalletConnect();
	}
	address = null;
	walletClient = null;
	status = 'disconnected';
	error = null;
	connectedVia = null;
}

// Auto-reconnect: check injected wallet first, then WalletConnect session
async function tryReconnect() {
	// Try injected wallet
	const accounts = await getConnectedAccounts();
	if (accounts.length > 0) {
		await connect('injected');
		return;
	}

	// Try WalletConnect session
	const wcResult = await reconnectWalletConnect();
	if (wcResult) {
		address = wcResult.address;
		walletClient = wcResult.walletClient;
		status = 'connected';
		connectedVia = 'walletconnect';
	}
}

// Listen for account changes from wallet
function setupListeners() {
	const cleanups: (() => void)[] = [];

	// Injected wallet listeners
	cleanups.push(
		onAccountsChanged((accounts) => {
			if (connectedVia !== 'injected') return;
			if (accounts.length === 0) {
				disconnect();
			} else {
				connect('injected');
			}
		})
	);

	// WalletConnect listeners
	cleanups.push(
		onWalletConnectAccountsChanged((accounts) => {
			if (connectedVia !== 'walletconnect') return;
			if (accounts.length === 0) {
				disconnect();
			} else {
				connect('walletconnect');
			}
		})
	);

	cleanups.push(
		onWalletConnectDisconnect(() => {
			if (connectedVia === 'walletconnect') {
				disconnect();
			}
		})
	);

	return () => cleanups.forEach((fn) => fn());
}

export const walletStore = {
	get address() { return address; },
	get status() { return status; },
	get walletClient() { return walletClient; },
	get error() { return error; },
	get isConnected() { return isConnected; },
	get connectedVia() { return connectedVia; },
	connect,
	disconnect,
	tryReconnect,
	setupListeners
};

import { createWalletClient, custom, type WalletClient, type Transport } from 'viem';
import {
	connectWalletConnect,
	disconnectWalletConnect,
	reconnectWalletConnect,
	onWalletConnectAccountsChanged,
	onWalletConnectDisconnect
} from '$lib/wallet/connect';
import {
	connectInjectedWallet,
	reconnectInjectedWallet,
	onInjectedAccountsChanged,
	onInjectedDisconnect
} from '$lib/wallet/injected';

export type ConnectMethod = 'walletconnect' | 'injected';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

let address = $state<`0x${string}` | null>(null);
let status = $state<ConnectionStatus>('disconnected');
let walletClient = $state<WalletClient<Transport> | null>(null);
let error = $state<string | null>(null);
let modalOpen = $state(false);
let connectedVia = $state<ConnectMethod | null>(null);
let initialized = $state(false);

let connectLock = false;

const isConnected = $derived(status === 'connected' && address !== null);

async function connect(method: ConnectMethod) {
	if (connectLock) return;
	connectLock = true;
	status = 'connecting';
	error = null;
	if (typeof window !== 'undefined') {
		localStorage.removeItem('hf_wallet_disconnected');
	}
	try {
		const result =
			method === 'injected'
				? await connectInjectedWallet()
				: await connectWalletConnect();
		address = result.address;
		walletClient = result.walletClient;
		connectedVia = method;
		status = 'connected';
		if (method === 'walletconnect') {
			setupWCListeners(); // wcProvider now exists
		}
	} catch (e) {
		status = 'disconnected';
		error = e instanceof Error ? e.message : String(e);
		throw e;
	} finally {
		connectLock = false;
	}
}

async function disconnect() {
	if (typeof window !== 'undefined') {
		localStorage.setItem('hf_wallet_disconnected', 'true');
	}
	const wasWC = connectedVia === 'walletconnect';
	address = null;
	walletClient = null;
	connectedVia = null;
	status = 'disconnected';
	error = null;
	if (wasWC) {
		await disconnectWalletConnect(); // fast fail — errors surface to caller
	}
}

async function tryReconnect() {
	// If the user explicitly disconnected, don't auto-reconnect anything.
	if (typeof window !== 'undefined' && localStorage.getItem('hf_wallet_disconnected') === 'true') {
		initialized = true;
		return;
	}

	try {
		// Try WalletConnect first (has an existing session?)
		const wcResult = await reconnectWalletConnect();
		if (wcResult) {
			address = wcResult.address;
			walletClient = wcResult.walletClient;
			connectedVia = 'walletconnect';
			status = 'connected';
			return;
		}

		// Fall back to injected (already authorised?)
		const injResult = await reconnectInjectedWallet();
		if (injResult) {
			address = injResult.address;
			walletClient = injResult.walletClient;
			connectedVia = 'injected';
			status = 'connected';
		}
	} finally {
		initialized = true; // always mark done, success or failure
	}
}

// Only injected listeners — safe to register immediately (no wcProvider dependency)
function setupListeners(): () => void {
	const cleanups: (() => void)[] = [];

	cleanups.push(
		onInjectedAccountsChanged((accounts) => {
			if (connectedVia !== 'injected') return;
			if (accounts.length === 0) {
				disconnect();
			} else {
				const newAddr = accounts[0] as `0x${string}`;
				if (newAddr !== address) {
					address = newAddr;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const ethereum = (window as any).ethereum;
					walletClient = createWalletClient({ account: newAddr, transport: custom(ethereum) });
				}
			}
		})
	);

	cleanups.push(
		onInjectedDisconnect(() => {
			if (connectedVia !== 'injected') return;
			disconnect();
		})
	);

	return () => cleanups.forEach((fn) => fn());
}

// WC-specific listeners — call only after wcProvider exists (post-connect or post-reconnect)
function setupWCListeners(): () => void {
	const cleanups: (() => void)[] = [];

	cleanups.push(
		onWalletConnectAccountsChanged((accounts) => {
			if (connectedVia !== 'walletconnect') return;
			if (accounts.length === 0) {
				disconnect();
			} else {
				const newAddr = accounts[0] as `0x${string}`;
				if (newAddr !== address) {
					address = newAddr; // only update address; transport (provider) stays the same
				}
			}
		})
	);

	cleanups.push(
		onWalletConnectDisconnect(() => {
			if (connectedVia !== 'walletconnect') return;
			disconnect();
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
	get modalOpen() { return modalOpen; },
	set modalOpen(v: boolean) { modalOpen = v; },
	get connectedVia() { return connectedVia; },
	get initialized() { return initialized; },
	connect,
	disconnect,
	tryReconnect,
	setupListeners,
	setupWCListeners
};

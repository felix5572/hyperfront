import type { WalletClient, Transport } from 'viem';
import {
	connectWalletConnect,
	disconnectWalletConnect,
	reconnectWalletConnect,
	onWalletConnectAccountsChanged,
	onWalletConnectDisconnect
} from '$lib/wallet/connect';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

let address = $state<`0x${string}` | null>(null);
let status = $state<ConnectionStatus>('disconnected');
let walletClient = $state<WalletClient<Transport> | null>(null);
let error = $state<string | null>(null);

let connectLock = false;

const isConnected = $derived(status === 'connected' && address !== null);

async function connect() {
	if (connectLock) return;
	connectLock = true;
	status = 'connecting';
	error = null;
	try {
		const result = await connectWalletConnect();
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

async function disconnect() {
	await disconnectWalletConnect();
	address = null;
	walletClient = null;
	status = 'disconnected';
	error = null;
}

async function tryReconnect() {
	const wcResult = await reconnectWalletConnect();
	if (wcResult) {
		address = wcResult.address;
		walletClient = wcResult.walletClient;
		status = 'connected';
	}
}

function setupListeners() {
	const cleanups: (() => void)[] = [];

	cleanups.push(
		onWalletConnectAccountsChanged((accounts) => {
			if (accounts.length === 0) disconnect();
			else connect();
		})
	);

	cleanups.push(
		onWalletConnectDisconnect(() => disconnect())
	);

	return () => cleanups.forEach((fn) => fn());
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

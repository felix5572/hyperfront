import { createWalletClient, custom, type WalletClient, type Transport, type Chain } from 'viem';
import { arbitrum } from 'viem/chains';

// EIP-1193 provider interface (MetaMask, Rabby, etc.)
interface EIP1193Provider {
	request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
	on: (event: string, handler: (...args: unknown[]) => void) => void;
	removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

function getInjectedProvider(): EIP1193Provider | null {
	if (typeof window === 'undefined') return null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (window as any).ethereum ?? null;
}

export type { EIP1193Provider };

export type ConnectResult = {
	address: `0x${string}`;
	walletClient: WalletClient<Transport, Chain>;
};

// ─── Injected wallet ────────────────────────────────────────────────

// Request wallet connection, returns address
export async function connectInjectedWallet(): Promise<ConnectResult> {
	const provider = getInjectedProvider();
	if (!provider) {
		throw new Error('No wallet detected. Please install MetaMask or another EIP-1193 wallet.');
	}

	const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
	if (!accounts.length) {
		throw new Error('No accounts returned from wallet.');
	}

	const address = accounts[0] as `0x${string}`;

	const walletClient = createWalletClient({
		account: address,
		chain: arbitrum,
		transport: custom(provider)
	});

	return { address, walletClient };
}

// Listen for account/chain changes
export function onAccountsChanged(
	callback: (accounts: string[]) => void
): () => void {
	const provider = getInjectedProvider();
	if (!provider) return () => { };

	const handler = (...args: unknown[]) => callback(args[0] as string[]);
	provider.on('accountsChanged', handler);
	return () => provider.removeListener('accountsChanged', handler);
}

export function onChainChanged(callback: (chainId: string) => void): () => void {
	const provider = getInjectedProvider();
	if (!provider) return () => { };

	const handler = (...args: unknown[]) => callback(args[0] as string);
	provider.on('chainChanged', handler);
	return () => provider.removeListener('chainChanged', handler);
}

// Check if a wallet is already connected (without prompting)
export async function getConnectedAccounts(): Promise<string[]> {
	const provider = getInjectedProvider();
	if (!provider) return [];
	const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
	return accounts;
}

// Check if injected wallet is available
export function hasInjectedWallet(): boolean {
	return getInjectedProvider() !== null;
}

// ─── WalletConnect ──────────────────────────────────────────────────

// Replace with your own projectId from https://cloud.walletconnect.com
const WALLETCONNECT_PROJECT_ID = 'd4deeac57a8cdbe013059f1680b15656';

// Lazy-loaded WalletConnect provider singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wcProvider: any = null;

async function getOrCreateWCProvider() {
	if (wcProvider) return wcProvider;

	const { default: EthereumProvider } = await import('@walletconnect/ethereum-provider');

	wcProvider = await EthereumProvider.init({
		projectId: WALLETCONNECT_PROJECT_ID,
		chains: [42161], // Arbitrum
		showQrModal: true,
		methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4'],
		metadata: {
			name: 'Hyperfront',
			description: 'Hyperfront Trading',
			url: typeof window !== 'undefined' ? window.location.origin : 'https://hyperfront.app',
			icons: [typeof window !== 'undefined' ? `${window.location.origin}/icons/icon-192.png` : '']
		}
	});

	return wcProvider;
}

export async function connectWalletConnect(): Promise<ConnectResult> {
	const provider = await getOrCreateWCProvider();

	try {
		// WalletConnect relay errors surface through event callbacks, not the promise.
		// Race against a timeout so we don't hang forever if the relay rejects us.
		await Promise.race([
			provider.connect(),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('WalletConnect connection timed out (60 s)')), 60_000)
			)
		]);
	} catch (e) {
		// Reset singleton so the next attempt gets a fresh provider instance
		wcProvider = null;
		throw e;
	}

	const accounts: string[] = provider.accounts;
	if (!accounts.length) {
		wcProvider = null;
		throw new Error('No accounts returned from WalletConnect.');
	}

	const address = accounts[0] as `0x${string}`;

	const walletClient = createWalletClient({
		account: address,
		chain: arbitrum,
		transport: custom(provider)
	});

	return { address, walletClient };
}

export async function disconnectWalletConnect(): Promise<void> {
	if (wcProvider) {
		await wcProvider.disconnect();
		wcProvider = null;
	}
}

// Check if there's an active WalletConnect session that can be restored
export async function hasWalletConnectSession(): Promise<boolean> {
	try {
		const provider = await getOrCreateWCProvider();
		return provider.session != null;
	} catch {
		return false;
	}
}

// Reconnect using an existing WalletConnect session (no QR modal)
export async function reconnectWalletConnect(): Promise<ConnectResult | null> {
	try {
		const provider = await getOrCreateWCProvider();
		if (!provider.session) return null;

		const accounts: string[] = provider.accounts;
		if (!accounts.length) return null;

		const address = accounts[0] as `0x${string}`;

		const walletClient = createWalletClient({
			account: address,
			chain: arbitrum,
			transport: custom(provider)
		});

		return { address, walletClient };
	} catch {
		return null;
	}
}

// Listen for WalletConnect events
export function onWalletConnectAccountsChanged(
	callback: (accounts: string[]) => void
): () => void {
	if (!wcProvider) return () => { };
	const handler = (accs: string[]) => callback(accs);
	wcProvider.on('accountsChanged', handler);
	return () => wcProvider?.removeListener('accountsChanged', handler);
}

export function onWalletConnectDisconnect(callback: () => void): () => void {
	if (!wcProvider) return () => { };
	const handler = () => callback();
	wcProvider.on('disconnect', handler);
	return () => wcProvider?.removeListener('disconnect', handler);
}

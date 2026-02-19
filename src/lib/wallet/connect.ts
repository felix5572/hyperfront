import { createWalletClient, custom, type WalletClient, type Transport } from 'viem';

export type ConnectResult = {
	address: `0x${string}`;
	walletClient: WalletClient<Transport>;
};

// ─── WalletConnect ──────────────────────────────────────────────────

const WALLETCONNECT_PROJECT_ID = 'd4deeac57a8cdbe013059f1680b15656';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wcProvider: any = null;

async function getOrCreateWCProvider() {
	if (wcProvider) return wcProvider;

	const { default: EthereumProvider } = await import('@walletconnect/ethereum-provider');

	wcProvider = await EthereumProvider.init({
		projectId: WALLETCONNECT_PROJECT_ID,
		optionalChains: [42161],
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
		await Promise.race([
			provider.connect(),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('WalletConnect connection timed out (60 s)')), 60_000)
			)
		]);
	} catch (e) {
		wcProvider = null;
		throw e;
	}

	const accounts: string[] = provider.accounts;
	if (!accounts.length) {
		wcProvider = null;
		throw new Error('No accounts returned from WalletConnect.');
	}

	const address = accounts[0] as `0x${string}`;
	const walletClient = createWalletClient({ account: address, transport: custom(provider) });
	return { address, walletClient };
}

export async function disconnectWalletConnect(): Promise<void> {
	if (wcProvider) {
		await wcProvider.disconnect();
		wcProvider = null;
	}
}

export async function reconnectWalletConnect(): Promise<ConnectResult | null> {
	const provider = await getOrCreateWCProvider();
	if (!provider.session) return null;

	const accounts: string[] = provider.accounts;
	if (!accounts.length) throw new Error('WalletConnect session exists but returned no accounts.');

	const address = accounts[0] as `0x${string}`;
	const walletClient = createWalletClient({ account: address, transport: custom(provider) });
	return { address, walletClient };
}

export function onWalletConnectAccountsChanged(callback: (accounts: string[]) => void): () => void {
	if (!wcProvider) return () => {};
	const handler = (accs: string[]) => callback(accs);
	wcProvider.on('accountsChanged', handler);
	return () => wcProvider?.removeListener('accountsChanged', handler);
}

export function onWalletConnectDisconnect(callback: () => void): () => void {
	if (!wcProvider) return () => {};
	const handler = () => callback();
	wcProvider.on('disconnect', handler);
	return () => wcProvider?.removeListener('disconnect', handler);
}

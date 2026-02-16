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

// Request wallet connection, returns address
export async function connectInjectedWallet(): Promise<{
	address: `0x${string}`;
	walletClient: WalletClient<Transport, Chain>;
}> {
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
	if (!provider) return () => {};

	const handler = (...args: unknown[]) => callback(args[0] as string[]);
	provider.on('accountsChanged', handler);
	return () => provider.removeListener('accountsChanged', handler);
}

export function onChainChanged(callback: (chainId: string) => void): () => void {
	const provider = getInjectedProvider();
	if (!provider) return () => {};

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

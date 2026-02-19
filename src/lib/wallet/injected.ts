import { createWalletClient, custom } from 'viem';
import type { ConnectResult } from './connect';

export function hasInjectedWallet(): boolean {
	return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

export async function connectInjectedWallet(): Promise<ConnectResult> {
	if (!hasInjectedWallet()) {
		throw new Error('No injected wallet found (install MetaMask or a similar browser extension).');
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ethereum = (window as any).ethereum;
	const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
	if (!accounts.length) throw new Error('No accounts returned from injected wallet.');
	const address = accounts[0] as `0x${string}`;
	const walletClient = createWalletClient({ account: address, transport: custom(ethereum) });
	return { address, walletClient };
}

export async function reconnectInjectedWallet(): Promise<ConnectResult | null> {
	if (!hasInjectedWallet()) return null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ethereum = (window as any).ethereum;
	const accounts: string[] = await ethereum.request({ method: 'eth_accounts' });
	if (!accounts.length) return null;
	const address = accounts[0] as `0x${string}`;
	const walletClient = createWalletClient({ account: address, transport: custom(ethereum) });
	return { address, walletClient };
}

export function onInjectedAccountsChanged(callback: (accounts: string[]) => void): () => void {
	if (!hasInjectedWallet()) return () => {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ethereum = (window as any).ethereum;
	ethereum.on('accountsChanged', callback);
	return () => ethereum.removeListener('accountsChanged', callback);
}

export function onInjectedDisconnect(callback: () => void): () => void {
	if (!hasInjectedWallet()) return () => {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ethereum = (window as any).ethereum;
	ethereum.on('disconnect', callback);
	return () => ethereum.removeListener('disconnect', callback);
}

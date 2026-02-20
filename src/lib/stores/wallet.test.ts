import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const connectMocks = vi.hoisted(() => ({
	connectWalletConnect: vi.fn(),
	disconnectWalletConnect: vi.fn(),
	reconnectWalletConnect: vi.fn(),
	onWalletConnectAccountsChanged: vi.fn(),
	onWalletConnectDisconnect: vi.fn()
}));

const injectedMocks = vi.hoisted(() => ({
	connectInjectedWallet: vi.fn(),
	reconnectInjectedWallet: vi.fn(),
	onInjectedAccountsChanged: vi.fn(),
	onInjectedDisconnect: vi.fn()
}));

vi.mock('$lib/wallet/connect', () => ({
	connectWalletConnect: connectMocks.connectWalletConnect,
	disconnectWalletConnect: connectMocks.disconnectWalletConnect,
	reconnectWalletConnect: connectMocks.reconnectWalletConnect,
	onWalletConnectAccountsChanged: connectMocks.onWalletConnectAccountsChanged,
	onWalletConnectDisconnect: connectMocks.onWalletConnectDisconnect
}));

vi.mock('$lib/wallet/injected', () => ({
	connectInjectedWallet: injectedMocks.connectInjectedWallet,
	reconnectInjectedWallet: injectedMocks.reconnectInjectedWallet,
	onInjectedAccountsChanged: injectedMocks.onInjectedAccountsChanged,
	onInjectedDisconnect: injectedMocks.onInjectedDisconnect
}));

vi.mock('viem', () => ({
	createWalletClient: vi.fn(({ account, transport }: { account: string; transport: unknown }) => ({ account, transport })),
	custom: vi.fn((provider: unknown) => ({ value: provider }))
}));

type WalletStoreModule = typeof import('./wallet.svelte');

function makeStorage() {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => data.set(key, value),
		removeItem: (key: string) => data.delete(key),
		clear: () => data.clear(),
		key: (index: number) => Array.from(data.keys())[index] ?? null,
		get length() { return data.size; }
	};
}

async function loadStore(): Promise<WalletStoreModule['walletStore']> {
	vi.resetModules();
	const mod = await import('./wallet.svelte');
	return mod.walletStore;
}

beforeEach(() => {
	vi.stubGlobal('$state', <T>(v: T) => v);
	vi.stubGlobal('$derived', <T>(v: T) => v);
	const localStorage = makeStorage();
	vi.stubGlobal('localStorage', localStorage);
	vi.stubGlobal('window', { localStorage, ethereum: { tag: 'eth-provider' } });

	connectMocks.connectWalletConnect.mockReset();
	connectMocks.disconnectWalletConnect.mockReset();
	connectMocks.reconnectWalletConnect.mockReset();
	connectMocks.onWalletConnectAccountsChanged.mockReset();
	connectMocks.onWalletConnectDisconnect.mockReset();
	injectedMocks.connectInjectedWallet.mockReset();
	injectedMocks.reconnectInjectedWallet.mockReset();
	injectedMocks.onInjectedAccountsChanged.mockReset();
	injectedMocks.onInjectedDisconnect.mockReset();

	connectMocks.onWalletConnectAccountsChanged.mockReturnValue(() => {});
	connectMocks.onWalletConnectDisconnect.mockReturnValue(() => {});
	injectedMocks.onInjectedAccountsChanged.mockReturnValue(() => {});
	injectedMocks.onInjectedDisconnect.mockReturnValue(() => {});
	connectMocks.disconnectWalletConnect.mockResolvedValue(undefined);
	connectMocks.reconnectWalletConnect.mockResolvedValue(null);
	injectedMocks.reconnectInjectedWallet.mockResolvedValue(null);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('wallet store', () => {
	it('disconnect(false) keeps local flag clear; disconnect(true) sets it', async () => {
		connectMocks.connectWalletConnect.mockResolvedValue({
			address: '0x1111111111111111111111111111111111111111',
			walletClient: { kind: 'wc-client' }
		});

		const walletStore = await loadStore();
		await walletStore.connect('walletconnect');

		await walletStore.disconnect(false);
		expect(walletStore.status).toBe('disconnected');
		expect(walletStore.address).toBeNull();
		expect(walletStore.connectedVia).toBeNull();
		expect(walletStore.lastDisconnectByUser).toBe(false);
		expect(localStorage.getItem('hf_wallet_disconnected')).toBeNull();

		await walletStore.connect('walletconnect');
		await walletStore.disconnect();
		expect(walletStore.lastDisconnectByUser).toBe(true);
		expect(localStorage.getItem('hf_wallet_disconnected')).toBe('true');
	});

	it('setupWCListeners is idempotent and cleans previous listeners', async () => {
		const cleanupA1 = vi.fn();
		const cleanupD1 = vi.fn();
		const cleanupA2 = vi.fn();
		const cleanupD2 = vi.fn();

		connectMocks.onWalletConnectAccountsChanged
			.mockReturnValueOnce(cleanupA1)
			.mockReturnValueOnce(cleanupA2);
		connectMocks.onWalletConnectDisconnect
			.mockReturnValueOnce(cleanupD1)
			.mockReturnValueOnce(cleanupD2);

		const walletStore = await loadStore();
		walletStore.setupWCListeners();
		const secondCleanup = walletStore.setupWCListeners();

		expect(cleanupA1).toHaveBeenCalledTimes(1);
		expect(cleanupD1).toHaveBeenCalledTimes(1);
		expect(cleanupA2).toHaveBeenCalledTimes(0);
		expect(cleanupD2).toHaveBeenCalledTimes(0);

		secondCleanup();
		expect(cleanupA2).toHaveBeenCalledTimes(1);
		expect(cleanupD2).toHaveBeenCalledTimes(1);
	});

	it('tryReconnect marks initialized=true even when reconnect throws', async () => {
		connectMocks.reconnectWalletConnect.mockRejectedValue(new Error('wc reconnect failed'));
		const walletStore = await loadStore();

		await expect(walletStore.tryReconnect()).rejects.toThrow('wc reconnect failed');
		expect(walletStore.initialized).toBe(true);
	});

	it('disconnect propagates WC errors but still clears local state first', async () => {
		connectMocks.connectWalletConnect.mockResolvedValue({
			address: '0x1111111111111111111111111111111111111111',
			walletClient: { kind: 'wc-client' }
		});
		connectMocks.disconnectWalletConnect.mockRejectedValue(new Error('wc disconnect failed'));

		const walletStore = await loadStore();
		await walletStore.connect('walletconnect');

		await expect(walletStore.disconnect()).rejects.toThrow('wc disconnect failed');
		expect(walletStore.status).toBe('disconnected');
		expect(walletStore.address).toBeNull();
		expect(walletStore.connectedVia).toBeNull();
		expect(walletStore.lastDisconnectByUser).toBe(true);
	});
});

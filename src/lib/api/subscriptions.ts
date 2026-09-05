import { subscriptionClient } from './client';
import { writable } from 'svelte/store';
import { WS_URL } from '$utils/constants';

// Subscription handle type from the SDK
type Subscription = { unsubscribe: () => Promise<void>; failureSignal: AbortSignal };

interface SubscriptionStatus {
	endpoint: string;
	activeCount: number;
	activeKeys: string[];
	uniqueUserCount: number;
	lastError: string | null;
	updatedAt: number;
}

// Active subscription registry for cleanup
const activeSubscriptions: Map<string, Subscription> = new Map();
// A subscription can still be awaiting its SDK handle when a route unmounts
// or starts a replacement. Invalidating the token also cancels that late handle.
const pendingSubscriptions = new Map<string, object>();
export const subscriptionError = writable<string | null>(null);
const userSpecificPrefixes = ['orderUpdates', 'openOrders', 'userFills', 'webData2', 'webData3', 'allDexsClearinghouseState'];

function computeUniqueUsers(keys: string[]): number {
	const users = new Set<string>();
	for (const key of keys) {
		const [prefix, maybeUser] = key.split(':');
		if (!maybeUser) continue;
		if (!userSpecificPrefixes.includes(prefix)) continue;
		if (/^0x[a-fA-F0-9]{40}$/.test(maybeUser)) users.add(maybeUser.toLowerCase());
	}
	return users.size;
}

function snapshotStatus(lastError: string | null = null): SubscriptionStatus {
	const activeKeys = [...activeSubscriptions.keys()].sort();
	return {
		endpoint: WS_URL,
		activeCount: activeKeys.length,
		activeKeys,
		uniqueUserCount: computeUniqueUsers(activeKeys),
		lastError,
		updatedAt: Date.now()
	};
}

export const subscriptionStatus = writable<SubscriptionStatus>(snapshotStatus());

function refreshStatus(lastError: string | null = null) {
	subscriptionStatus.set(snapshotStatus(lastError));
}

// Subscribe with automatic tracking and cleanup
async function subscribe(
	key: string,
	subscribeFn: () => Promise<Subscription>,
	onFailure?: (error: Error) => void
): Promise<void> {
	subscriptionError.set(null);
	const token = {};
	const existing = activeSubscriptions.get(key);
	activeSubscriptions.delete(key);
	pendingSubscriptions.set(key, token);
	refreshStatus();
	try {
		if (existing) await existing.unsubscribe();
		if (pendingSubscriptions.get(key) !== token) return;
		const sub = await subscribeFn();
		if (pendingSubscriptions.get(key) !== token) {
			await sub.unsubscribe();
			return;
		}
		pendingSubscriptions.delete(key);
		activeSubscriptions.set(key, sub);
		refreshStatus();

		const handleFailure = () => {
			// A delayed abort from a replaced handle must not delete its successor.
			if (activeSubscriptions.get(key) !== sub) return;
			activeSubscriptions.delete(key);
			const reason = sub.failureSignal.reason instanceof Error
				? sub.failureSignal.reason.message
				: String(sub.failureSignal.reason ?? 'Unknown websocket failure');
			const message = `Subscription "${key}" failed: ${reason}`;
			subscriptionError.set(message);
			refreshStatus(message);
			onFailure?.(new Error(message));
			console.error(message);
		};
		sub.failureSignal.addEventListener('abort', handleFailure, { once: true });
		if (sub.failureSignal.aborted) handleFailure();
	} catch (error) {
		if (pendingSubscriptions.get(key) !== token) return;
		pendingSubscriptions.delete(key);
		throw error;
	}
}

async function unsubscribe(key: string): Promise<void> {
	pendingSubscriptions.delete(key);
	const existing = activeSubscriptions.get(key);
	activeSubscriptions.delete(key);
	refreshStatus();
	if (existing) {
		await existing.unsubscribe();
	}
}

async function unsubscribeAll(): Promise<void> {
	pendingSubscriptions.clear();
	const subscriptions = [...activeSubscriptions.values()];
	activeSubscriptions.clear();
	refreshStatus();
	const promises = subscriptions.map((sub) => sub.unsubscribe());
	await Promise.allSettled(promises);
	refreshStatus();
}

// --- Subscription helpers ---

export async function subscribeL2Book(
	coin: string,
	callback: (data: { coin: string; levels: [Array<{ px: string; sz: string; n: number }>, Array<{ px: string; sz: string; n: number }>]; time: number }) => void,
	onFailure?: (error: Error) => void
): Promise<void> {
	await subscribe(`l2Book:${coin}`, () =>
		subscriptionClient.l2Book({ coin }, callback), onFailure
	);
}

export async function subscribeTrades(
	coin: string,
	callback: (data: Array<{ coin: string; side: string; px: string; sz: string; time: number; tid: number }>) => void
): Promise<void> {
	await subscribe(`trades:${coin}`, () =>
		subscriptionClient.trades({ coin }, callback)
	);
}

export async function subscribeAllMids(
	callback: (data: { mids: Record<string, string> }) => void
): Promise<void> {
	await subscribe('allMids', () =>
		subscriptionClient.allMids(callback)
	);
}

type CandleInterval = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";

export async function subscribeCandle(
	coin: string,
	interval: string,
	callback: (data: unknown) => void
): Promise<void> {
	await subscribe(`candle:${coin}:${interval}`, () =>
		subscriptionClient.candle({ coin, interval: interval as CandleInterval }, callback)
	);
}

export async function subscribeActiveAssetCtx(
	coin: string,
	callback: (data: unknown) => void
): Promise<void> {
	await subscribe(`activeAssetCtx:${coin}`, () =>
		subscriptionClient.activeAssetCtx({ coin }, callback)
	);
}

export async function subscribeOrderUpdates(
	user: `0x${string}`,
	callback: (data: unknown) => void
): Promise<void> {
	await subscribe(`orderUpdates:${user}`, () =>
		subscriptionClient.orderUpdates({ user }, callback)
	);
}

/** Subscribe to openOrders: full snapshot { dex, user, orders: Order[] } on each update. */
export async function subscribeOpenOrders(
	user: `0x${string}`,
	callback: (data: { dex: string; user: `0x${string}`; orders: unknown[] }) => void,
	dex = '',
	onFailure?: (error: Error) => void
): Promise<void> {
	await subscribe(`openOrders:${user}:${dex}`, () =>
		subscriptionClient.openOrders({ user, dex }, callback), onFailure
	);
}

export async function subscribeUserFills(
	user: `0x${string}`,
	callback: (data: unknown) => void,
	onFailure?: (error: Error) => void
): Promise<void> {
	await subscribe(`userFills:${user}`, () =>
		subscriptionClient.userFills({ user }, callback), onFailure
	);
}

export async function subscribeWebData2(
	user: `0x${string}`,
	callback: (data: unknown) => void
): Promise<void> {
	await subscribe(`webData2:${user}`, () =>
		subscriptionClient.webData2({ user }, callback)
	);
}

/** Subscribe to all DEXs clearinghouse state (perp positions + margin). Use this for Portfolio real-time updates. */
export async function subscribeAllDexsClearinghouseState(
	user: `0x${string}`,
	callback: (data: { user: string; clearinghouseStates: [string, unknown][] }) => void,
	onFailure?: (error: Error) => void
): Promise<void> {
	await subscribe(`allDexsClearinghouseState:${user}`, () =>
		subscriptionClient.allDexsClearinghouseState({ user }, callback), onFailure
	);
}

/** Subscribe to webData3 (userState, perpDexStates, and any undocumented fields). Store full payload. */
export async function subscribeWebData3(
	user: `0x${string}`,
	callback: (data: unknown) => void,
	onFailure?: (error: Error) => void
): Promise<void> {
	await subscribe(`webData3:${user}`, () =>
		subscriptionClient.webData3({ user }, (d) => callback(d)), onFailure
	);
}

export { unsubscribe, unsubscribeAll };

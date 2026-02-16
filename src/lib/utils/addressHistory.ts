const STORAGE_KEY = 'hyperfront:addressHistory';
const MAX_ENTRIES = 10;

export function getAddressHistory(): string[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((x): x is string => typeof x === 'string' && /^0x[a-fA-F0-9]{40}$/.test(x));
	} catch {
		return [];
	}
}

export function pushAddressHistory(address: string): void {
	if (typeof localStorage === 'undefined') return;
	const trimmed = address.trim();
	if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return;
	let list = getAddressHistory();
	list = [trimmed, ...list.filter((a) => a.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_ENTRIES);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function removeAddressHistory(address: string): void {
	if (typeof localStorage === 'undefined') return;
	const trimmed = address.trim().toLowerCase();
	const list = getAddressHistory().filter((a) => a.toLowerCase() !== trimmed);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

<script lang="ts">
	import { onMount } from "svelte";
	import { walletStore } from "$stores/wallet.svelte";
	import { accountStore } from "$stores/account.svelte";
	import { infoClient } from "$api/client";
	import { subscriptionStatus } from "$api/subscriptions";
	import AddressInput from "$components/portfolio/AddressInput.svelte";
	import { INFO_URL } from "$utils/constants";
	import { formatTime, formatUsd } from "$utils/format";

	const appVersion =
		typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

	type SubAccountItem = {
		name?: string;
		subAccountUser: `0x${string}`;
		master: `0x${string}`;
		clearinghouseState?: {
			withdrawable?: string;
			marginSummary?: { accountValue?: string };
		};
		spotState?: {
			balances?: Array<{ coin: string; total: string }>;
		};
	};

	type ReferralInfo = {
		referredBy?: { referrer: string; code: string } | null;
		cumVlm?: string;
		unclaimedRewards?: string;
		claimedRewards?: string;
		builderRewards?: string;
		referrerState?: {
			stage?: string;
			data?: {
				code?: string;
				referralStates?: Array<{
					user: string;
					timeJoined: number;
					cumVlm: string;
					cumFeesRewardedToReferrer: string;
				}>;
			};
		};
	};

	type UserFeesInfo = {
		userCrossRate?: string;
		userAddRate?: string;
		userSpotCrossRate?: string;
		userSpotAddRate?: string;
		activeReferralDiscount?: string;
		activeStakingDiscount?: {
			discount?: string;
			bpsOfMaxSupply?: string;
		} | null;
		dailyUserVlm?: Array<{ date: string; exchange: string }>;
	};
	type UserRateLimitInfo = {
		cumVlm?: string;
		nRequestsUsed?: number;
		nRequestsCap?: number;
		nRequestsSurplus?: number;
	};

	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{
			outcome: "accepted" | "dismissed";
			platform: string;
		}>;
	};

	// Shared address: driven by accountStore.viewAddress (same as Portfolio/Orders)
	let infoLoadedFor = $state<string | null>(null);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let installError = $state<string | null>(null);
	let installPromptEvent = $state<BeforeInstallPromptEvent | null>(null);
	let installing = $state(false);
	let isStandalone = $state(false);
	let isIOS = $state(false);
	let showInstallTips = $state(true);

	let subAccounts = $state<SubAccountItem[]>([]);
	let referral = $state<ReferralInfo | null>(null);
	let userFees = $state<UserFeesInfo | null>(null);
	let userRateLimit = $state<UserRateLimitInfo | null>(null);
	let abstraction = $state<string | null>(null);

	let rawSubAccounts = $state<unknown>(null);
	let rawReferral = $state<unknown>(null);
	let rawUserFees = $state<unknown>(null);
	let rawUserRateLimit = $state<unknown>(null);
	let rawAbstraction = $state<unknown>(null);

	async function fetchUserAbstraction(
		user: `0x${string}`,
	): Promise<string | null> {
		const res = await fetch(INFO_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "userAbstraction",
				user,
			}),
		});
		if (!res.ok)
			throw new Error(
				`userAbstraction failed: ${res.status} ${res.statusText}`,
			);
		const txt = await res.text();
		try {
			const parsed = JSON.parse(txt);
			rawAbstraction = parsed;
			return typeof parsed === "string" ? parsed : null;
		} catch {
			rawAbstraction = txt;
			return null;
		}
	}

	async function fetchUserRateLimit(
		user: `0x${string}`,
	): Promise<UserRateLimitInfo | null> {
		const res = await fetch(INFO_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "userRateLimit",
				user,
			}),
		});
		if (!res.ok)
			throw new Error(
				`userRateLimit failed: ${res.status} ${res.statusText}`,
			);
		const parsed = await res.json();
		rawUserRateLimit = parsed;
		return (parsed as UserRateLimitInfo) ?? null;
	}

	async function loadInfo(user: `0x${string}`) {
		infoLoadedFor = user;
		loading = true;
		loadError = null;
		try {
			const [sub, ref, fees, abs, rateLimit] = await Promise.all([
				infoClient.subAccounts({ user }),
				infoClient.referral({ user }),
				infoClient.userFees({ user }),
				fetchUserAbstraction(user),
				fetchUserRateLimit(user),
			]);

			subAccounts = (sub as unknown as SubAccountItem[]) ?? [];
			referral = (ref as unknown as ReferralInfo) ?? null;
			userFees = (fees as unknown as UserFeesInfo) ?? null;
			abstraction = abs;
			userRateLimit = rateLimit;

			rawSubAccounts = sub;
			rawReferral = ref;
			rawUserFees = fees;
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	function getUsdBalance(sub: SubAccountItem): string {
		const usdc = sub.spotState?.balances?.find((b) => b.coin === "USDC");
		return usdc?.total ?? "0";
	}

	async function installApp() {
		if (!installPromptEvent) return;
		installError = null;
		installing = true;
		try {
			await installPromptEvent.prompt();
			const choice = await installPromptEvent.userChoice;
			if (choice.outcome === "accepted") {
				installPromptEvent = null;
				showInstallTips = false;
			}
		} catch (e) {
			installError = e instanceof Error ? e.message : String(e);
		} finally {
			installing = false;
		}
	}

	onMount(() => {
		if (typeof window === "undefined") return;
		isStandalone =
			window.matchMedia("(display-mode: standalone)").matches ||
			// iOS Safari
			(window.navigator as Navigator & { standalone?: boolean })
				.standalone === true;
		isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

		const onBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			installPromptEvent = event as BeforeInstallPromptEvent;
		};
		const onAppInstalled = () => {
			isStandalone = true;
			installPromptEvent = null;
			showInstallTips = false;
		};

		window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
		window.addEventListener("appinstalled", onAppInstalled);

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				onBeforeInstallPrompt,
			);
			window.removeEventListener("appinstalled", onAppInstalled);
		};
	});

	// React to shared address (from Portfolio/Orders) or wallet auto-connect
	$effect(() => {
		const addr = accountStore.viewAddress ?? walletStore.address ?? null;
		if (addr && addr !== infoLoadedFor) {
			void loadInfo(addr as `0x${string}`);
		}
	});
</script>

<svelte:head>
	<title>Info | Hyperfront</title>
</svelte:head>

<div class="flex flex-col h-full overflow-y-auto">
	<AddressInput
		onView={(addr) => {
			void accountStore.loadAddress(addr);
			void loadInfo(addr);
		}}
		{loading}
		showConnectWallet
		currentViewAddress={accountStore.viewAddress}
	/>

	{#if showInstallTips}
		<div class="px-4 pb-2">
			<div
				class="p-3 rounded-lg border border-border-secondary bg-surface-secondary space-y-2"
			>
				<div class="flex items-center justify-between">
					<h3 class="text-xs font-semibold">
						Install Hyperfront App (PWA)
					</h3>
					{#if isStandalone}
						<span
							class="text-[10px] px-1.5 py-0.5 rounded bg-long-dim text-long"
							>Installed</span
						>
					{/if}
				</div>

				{#if !isStandalone && installPromptEvent}
					<p class="text-[11px] text-gray-500">
						Use the button below to install Hyperfront to your
						device home screen.
					</p>
					<button
						class="text-sm font-semibold px-4 py-2 rounded-lg border border-accent/70 bg-accent text-white shadow-[0_8px_24px_-8px_rgba(59,130,246,0.75)] hover:bg-accent/90 hover:scale-[1.02] transition disabled:opacity-50 disabled:hover:scale-100"
						disabled={installing}
						onclick={installApp}
						>{installing
							? "Installing…"
							: "Install Hyperfront App"}</button
					>
				{:else if !isStandalone && isIOS}
					<p class="text-[11px] text-gray-500">
						iOS Safari manual install: tap Share, then choose “Add
						to Home Screen”.
					</p>
				{:else if !isStandalone}
					<p class="text-[11px] text-gray-500">
						If install button is unavailable, open browser menu and
						choose “Install app” / “Add to Home Screen”.
					</p>
				{/if}

				{#if installError}
					<p class="text-xs text-red-600">{installError}</p>
				{/if}
			</div>
		</div>
	{/if}

	<div class="px-4 pb-2">
		<div class="p-3 rounded-lg border border-amber-200 bg-amber-50">
			<h3 class="text-xs font-semibold text-amber-800 mb-2">
				Disclaimer
			</h3>
			<div
				class="text-[11px] text-amber-900/80 space-y-1.5 leading-relaxed"
			>
				<p>
					<strong class="font-semibold text-amber-900"
						>Unofficial.</strong
					> Hyperfront has no affiliation with Hyperliquid. It is not created,
					endorsed, or maintained by the Hyperliquid team. When in doubt,
					use the official interface.
				</p>
				<p>
					<strong class="font-semibold text-amber-900">Buggy.</strong>
					This is an early-stage open-source project. There are bugs. Data
					may be wrong. Orders may behave unexpectedly. Do not rely on
					it as your only tool. (PRs welcome)
				</p>
				<p>
					<strong class="font-semibold text-amber-900"
						>Not financial advice.</strong
					> Nothing shown here constitutes investment advice. You are fully
					responsible for your own trades and losses.
				</p>
				<p>
					<strong class="font-semibold text-amber-900"
						>Your keys stay yours.</strong
					> Hyperfront never asks for your wallet's private key or seed
					phrase. It never will. You approve a trade-only agent key in
					your wallet; it signs orders on this device and expires after
					24 hours.
				</p>
				<p>
					<strong class="font-semibold text-amber-900"
						>Verify before you sign.</strong
					> Only approve wallet prompts you understand. Use an agent wallet
					with limited permissions and small balances when possible.
				</p>
			</div>
		</div>
	</div>

	<div class="px-4 pb-2">
		<div
			class="flex items-center justify-center p-2 rounded-lg border border-border-secondary bg-surface-secondary/50"
		>
			<span class="text-[10px] text-gray-400 font-mono tracking-wide">
				Version {appVersion}
			</span>
		</div>
	</div>

	<div class="px-4 pb-2">
		<div
			class="p-3 rounded-lg border border-border-secondary bg-surface-secondary"
		>
			<div class="flex items-center justify-between mb-1">
				<h3 class="text-xs font-semibold">WebSocket Status</h3>
				<span class="text-[10px] text-gray-500"
					>{formatTime($subscriptionStatus.updatedAt)}</span
				>
			</div>
			<div class="grid grid-cols-2 gap-2 text-[11px]">
				<div>
					<p class="text-gray-500">Endpoint</p>
					<p class="font-mono break-all">
						{$subscriptionStatus.endpoint}
					</p>
				</div>
				<div>
					<p class="text-gray-500">Active Subscriptions</p>
					<p class="font-semibold tabular-nums">
						{$subscriptionStatus.activeCount}
					</p>
				</div>
				<div>
					<p class="text-gray-500">Unique User Streams</p>
					<p class="font-semibold tabular-nums">
						{$subscriptionStatus.uniqueUserCount}
					</p>
				</div>
				<div>
					<p class="text-gray-500">Limit Reference</p>
					<p class="text-gray-600">1000 subs / 10 users</p>
				</div>
			</div>
			{#if $subscriptionStatus.lastError}
				<p class="mt-2 text-xs text-red-600 break-words">
					{$subscriptionStatus.lastError}
				</p>
			{/if}
			<details class="mt-2">
				<summary class="text-[11px] text-gray-600 cursor-pointer"
					>Active Keys ({$subscriptionStatus.activeKeys
						.length})</summary
				>
				<div class="mt-1 max-h-28 overflow-y-auto space-y-0.5">
					{#if $subscriptionStatus.activeKeys.length === 0}
						<p class="text-[11px] text-gray-500">
							No active subscriptions
						</p>
					{:else}
						{#each $subscriptionStatus.activeKeys as key (key)}
							<p
								class="text-[10px] font-mono text-gray-600 break-all"
							>
								{key}
							</p>
						{/each}
					{/if}
				</div>
			</details>
		</div>
	</div>

	{#if loadError}
		<div class="px-4 pb-2">
			<p class="text-xs text-red-600">{loadError}</p>
		</div>
	{/if}

	{#if !accountStore.viewAddress && !loading}
		<div
			class="flex-1 flex items-center justify-center p-8 text-center text-sm text-gray-500"
		>
			Enter an address (or connect wallet) to load user info.
		</div>
	{:else if loading}
		<div
			class="flex-1 flex items-center justify-center p-8 text-sm text-gray-500"
		>
			Loading user info...
		</div>
	{:else}
		<div class="px-4 pb-3">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold">User Info</h2>
				<button
					class="text-[11px] px-2 py-1 rounded border border-border-primary text-gray-600 hover:bg-surface-hover"
					onclick={() =>
						accountStore.viewAddress &&
						loadInfo(accountStore.viewAddress)}>Refresh</button
				>
			</div>
			<p class="text-[11px] text-gray-500 font-mono mt-1 break-all">
				{accountStore.viewAddress}
			</p>
		</div>

		<div class="px-4 pb-4 space-y-3">
			<div
				class="p-3 rounded-lg border border-border-secondary bg-surface-secondary"
			>
				<h3 class="text-xs font-semibold mb-2">Abstraction</h3>
				<p class="text-sm font-mono">{abstraction ?? "N/A"}</p>
			</div>

			<div
				class="p-3 rounded-lg border border-border-secondary bg-surface-secondary"
			>
				<h3 class="text-xs font-semibold mb-2">
					Sub Accounts ({subAccounts.length})
				</h3>
				{#if subAccounts.length === 0}
					<p class="text-xs text-gray-500">No subaccounts</p>
				{:else}
					<div class="space-y-2">
						{#each subAccounts as sub (sub.subAccountUser)}
							<div
								class="p-2 rounded border border-border-secondary bg-surface-tertiary/50"
							>
								<div class="text-xs font-medium">
									{sub.name || "Unnamed"}
								</div>
								<div
									class="text-[11px] text-gray-500 font-mono break-all mt-0.5"
								>
									{sub.subAccountUser}
								</div>
								<div
									class="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-600"
								>
									<span
										>Account Value {formatUsd(
											parseFloat(
												sub.clearinghouseState
													?.marginSummary
													?.accountValue ?? "0",
											),
										)}</span
									>
									<span
										>Withdrawable {formatUsd(
											parseFloat(
												sub.clearinghouseState
													?.withdrawable ?? "0",
											),
										)}</span
									>
									<span
										>USDC {formatUsd(
											parseFloat(getUsdBalance(sub)),
										)}</span
									>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div
				class="p-3 rounded-lg border border-border-secondary bg-surface-secondary"
			>
				<h3 class="text-xs font-semibold mb-2">Referral</h3>
				<div class="space-y-1 text-[11px]">
					<p>
						Referred By: <span class="font-mono"
							>{referral?.referredBy?.referrer ?? "N/A"}</span
						>
					</p>
					<p>
						Code: <span class="font-mono"
							>{referral?.referredBy?.code ?? "N/A"}</span
						>
					</p>
					<p>
						Cumulative Volume: {formatUsd(
							parseFloat(referral?.cumVlm ?? "0"),
						)}
					</p>
					<p>
						Unclaimed Rewards: {formatUsd(
							parseFloat(referral?.unclaimedRewards ?? "0"),
						)}
					</p>
					<p>
						Claimed Rewards: {formatUsd(
							parseFloat(referral?.claimedRewards ?? "0"),
						)}
					</p>
					<p>
						Builder Rewards: {formatUsd(
							parseFloat(referral?.builderRewards ?? "0"),
						)}
					</p>
				</div>
				{#if referral?.referrerState?.data?.referralStates?.length}
					<div class="mt-2 border-t border-border-secondary pt-2">
						<p class="text-[11px] text-gray-500 mb-1">
							Referral Users ({referral.referrerState.data
								.referralStates.length})
						</p>
						<div class="space-y-1">
							{#each referral.referrerState.data.referralStates.slice(0, 5) as s (s.user)}
								<div class="text-[11px]">
									<span class="font-mono">{s.user}</span>
									<span class="text-gray-500">
										· Joined {formatTime(s.timeJoined)} · Vlm
										{formatUsd(
											parseFloat(s.cumVlm ?? "0"),
										)}</span
									>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div
				class="p-3 rounded-lg border border-border-secondary bg-surface-secondary"
			>
				<h3 class="text-xs font-semibold mb-2">API Rate Limit</h3>
				<div class="grid grid-cols-2 gap-2 text-[11px]">
					<div>
						Used: <span class="font-mono tabular-nums"
							>{userRateLimit?.nRequestsUsed ?? 0}</span
						>
					</div>
					<div>
						Cap: <span class="font-mono tabular-nums"
							>{userRateLimit?.nRequestsCap ?? 0}</span
						>
					</div>
					<div>
						Surplus: <span class="font-mono tabular-nums"
							>{userRateLimit?.nRequestsSurplus ?? 0}</span
						>
					</div>
					<div>
						Usage:
						<span class="font-mono tabular-nums">
							{#if (userRateLimit?.nRequestsCap ?? 0) > 0}
								{(
									((userRateLimit?.nRequestsUsed ?? 0) /
										(userRateLimit?.nRequestsCap ?? 1)) *
									100
								).toFixed(2)}%
							{:else}
								0.00%
							{/if}
						</span>
					</div>
				</div>
				<p class="mt-2 text-[11px] text-gray-600">
					Cumulative Volume: {formatUsd(
						parseFloat(userRateLimit?.cumVlm ?? "0"),
					)}
				</p>
			</div>

			<div
				class="p-3 rounded-lg border border-border-secondary bg-surface-secondary"
			>
				<h3 class="text-xs font-semibold mb-2">Fees</h3>
				<div class="grid grid-cols-2 gap-2 text-[11px]">
					<div>
						User Cross Rate: <span class="font-mono"
							>{userFees?.userCrossRate ?? "N/A"}</span
						>
					</div>
					<div>
						User Add Rate: <span class="font-mono"
							>{userFees?.userAddRate ?? "N/A"}</span
						>
					</div>
					<div>
						User Spot Cross: <span class="font-mono"
							>{userFees?.userSpotCrossRate ?? "N/A"}</span
						>
					</div>
					<div>
						User Spot Add: <span class="font-mono"
							>{userFees?.userSpotAddRate ?? "N/A"}</span
						>
					</div>
					<div>
						Referral Discount: <span class="font-mono"
							>{userFees?.activeReferralDiscount ?? "0"}</span
						>
					</div>
					<div>
						Staking Discount: <span class="font-mono"
							>{userFees?.activeStakingDiscount?.discount ??
								"0"}</span
						>
					</div>
				</div>
			</div>

			<details
				class="p-3 rounded-lg border border-border-secondary bg-surface-secondary"
			>
				<summary class="text-xs font-semibold cursor-pointer"
					>Raw JSON</summary
				>
				<div class="mt-2 space-y-2">
					<details>
						<summary class="text-[11px] cursor-pointer"
							>subAccounts</summary
						>
						<pre
							class="mt-1 text-[10px] overflow-x-auto">{JSON.stringify(
								rawSubAccounts,
								null,
								2,
							)}</pre>
					</details>
					<details>
						<summary class="text-[11px] cursor-pointer"
							>referral</summary
						>
						<pre
							class="mt-1 text-[10px] overflow-x-auto">{JSON.stringify(
								rawReferral,
								null,
								2,
							)}</pre>
					</details>
					<details>
						<summary class="text-[11px] cursor-pointer"
							>userFees</summary
						>
						<pre
							class="mt-1 text-[10px] overflow-x-auto">{JSON.stringify(
								rawUserFees,
								null,
								2,
							)}</pre>
					</details>
					<details>
						<summary class="text-[11px] cursor-pointer"
							>userRateLimit</summary
						>
						<pre
							class="mt-1 text-[10px] overflow-x-auto">{JSON.stringify(
								rawUserRateLimit,
								null,
								2,
							)}</pre>
					</details>
					<details>
						<summary class="text-[11px] cursor-pointer"
							>userAbstraction</summary
						>
						<pre
							class="mt-1 text-[10px] overflow-x-auto">{JSON.stringify(
								rawAbstraction,
								null,
								2,
							)}</pre>
					</details>
				</div>
			</details>
		</div>
	{/if}
</div>

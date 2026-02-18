<script lang="ts">
	import { walletStore } from '$stores/wallet.svelte';

	const STORAGE_KEY = 'hyperfront_disclaimer_accepted';

	let visible = $state(false);

	$effect(() => {
		if (walletStore.isConnected) {
			if (typeof localStorage !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
				visible = true;
			}
		}
	});

	function accept() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, '1');
		}
		visible = false;
	}
</script>

{#if visible}
	<div class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
		<div class="w-full max-w-sm bg-surface-primary border-2 border-yellow-500/60 rounded-2xl shadow-2xl overflow-hidden">
			<!-- Header -->
			<div class="flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/30">
				<svg class="w-5 h-5 text-yellow-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
					<line x1="12" y1="9" x2="12" y2="13"/>
					<line x1="12" y1="17" x2="12.01" y2="17"/>
				</svg>
				<span class="text-sm font-bold text-yellow-400 tracking-wide uppercase">使用前须知</span>
			</div>

			<!-- Body -->
			<div class="px-4 py-4 space-y-3 text-sm">
				<div class="flex gap-2.5">
					<span class="text-yellow-400 font-bold shrink-0">①</span>
					<span><span class="font-semibold text-text-primary">非官方 · 开源</span><span class="text-gray-400"> — 与 Hyperliquid 官方无关，代码公开，欢迎 PR。</span></span>
				</div>
				<div class="flex gap-2.5">
					<span class="text-yellow-400 font-bold shrink-0">②</span>
					<span><span class="font-semibold text-text-primary">测试阶段</span><span class="text-gray-400"> — 必定存在 Bug，数据可能有误，以官方界面为准。</span></span>
				</div>
				<div class="flex gap-2.5">
					<span class="text-yellow-400 font-bold shrink-0">③</span>
					<span><span class="font-semibold text-text-primary">非投资建议</span><span class="text-gray-400"> — 不对任何信息误导负责，盈亏自负。</span></span>
				</div>
				<div class="flex gap-2.5">
					<span class="text-long font-bold shrink-0">④</span>
					<span><span class="font-semibold text-text-primary">不索取私钥</span><span class="text-gray-400"> — 本工具永远不会要求私钥，仅下单时需要钱包签名。</span></span>
				</div>
				<div class="flex gap-2.5">
					<span class="text-gray-400 font-bold shrink-0">⑤</span>
					<span class="text-gray-400">定位为看盘 / 行情突变时的备用入场工具，不替代官方界面。</span>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-4 pb-4">
				<button
					class="w-full py-2.5 text-sm font-semibold bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl transition-colors active:scale-[0.98]"
					onclick={accept}
				>
					我已知晓，继续使用
				</button>
			</div>
		</div>
	</div>
{/if}

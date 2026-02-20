import type { WalletClient } from 'viem';
import type { AbstractWallet } from '@nktkas/hyperliquid/signing';

/**
 * Builds an SDK-compatible AbstractWallet from a WalletClient.
 *
 * We call eth_signTypedData_v4 directly via the transport instead of using
 * viem's signTypedData action, because viem validates that domain.chainId
 * matches the wallet's currently connected chain. Hyperliquid's EIP-712 domain
 * always uses chainId 1337 regardless of which chain the wallet is on — this is
 * a Hyperliquid protocol requirement, not a mistake. The direct RPC call skips
 * viem's chain validation while still producing a correct EIP-712 signature.
 */
export function createHlWalletAdapter(
	walletClient: WalletClient | null,
	address: `0x${string}` | null
): AbstractWallet | null {
	if (!walletClient || !address) return null;
	return {
		address,
		async signTypedData(params: {
			domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
			types: Record<string, { name: string; type: string }[]>;
			primaryType: string;
			message: Record<string, unknown>;
		}) {
			const typedData = JSON.stringify({
				domain: params.domain,
				types: params.types,
				primaryType: params.primaryType,
				message: params.message
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (walletClient as any).request({
				method: 'eth_signTypedData_v4',
				params: [address, typedData]
			}) as Promise<`0x${string}`>;
		}
	};
}

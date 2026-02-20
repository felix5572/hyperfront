import type { WalletClient } from 'viem';
import type { AbstractWallet } from '@nktkas/hyperliquid/signing';

/**
 * Builds an SDK-compatible AbstractWallet from a WalletClient.
 *
 * It proxies signTypedData to the viem WalletClient.
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
			// Extract out EIP712Domain to prevent viem types from complaining
			const { EIP712Domain, ...restTypes } = params.types;
			return walletClient.signTypedData({
				account: address,
				domain: params.domain,
				types: restTypes,
				primaryType: params.primaryType,
				message: params.message
			}) as Promise<`0x${string}`>;
		}
	};
}

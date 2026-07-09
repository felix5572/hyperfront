#!/usr/bin/env python3
"""
用硬件钱包（OneKey Pro / Ledger）批准 Hyperliquid Agent Wallet。

Agent Wallet 只能签名交易（下单/撤单），不能提币/转账。
Master Wallet 签一次 approveAgent，之后所有交易由 Agent 私钥自动签名。

两种签名模式:
  --ledger   USB 直连硬件钱包（Ledger 协议，APDU INS=0x0C EIP-712 blind signing）
  --manual   脚本输出 EIP-712 JSON，你在浏览器用钱包插件签名后粘贴回来

用法:
  pip install eth-account requests ledgereth
  python approve_agent.py --days 30 --ledger
  python approve_agent.py --days 30 --manual

参考文档:
  - Hyperliquid approveAgent API:
    https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint#approve-an-api-wallet
  - EIP-712 Typed Data Signing:
    https://eips.ethereum.org/EIPS/eip-712
  - Ledger Ethereum App APDU (INS=0x0C for EIP-712):
    https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc
  - 本项目前端实现参考:
    src/lib/api/exchange.ts (approveAgentWallet)
    src/lib/wallet/agent_wallet.md
"""

from __future__ import annotations

import argparse
import json
import secrets
import sys
import time
from pathlib import Path

import requests
from eth_account import Account
from eth_account.messages import encode_typed_data


# ── Hyperliquid API ──────────────────────────────────────────────
# POST https://api.hyperliquid.xyz/exchange
# Body: { action: ApproveAgentAction, nonce: number, signature: {r, s, v} }
# Ref: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint#approve-an-api-wallet
EXCHANGE_API = "https://api.hyperliquid.xyz/exchange"

# EIP-712 签名使用 Arbitrum chain ID
# Ref: signatureChainId in agent_wallet.md
SIGNATURE_CHAIN_ID = "0xa4b1"  # 42161
SIGNATURE_CHAIN_ID_INT = 0xA4B1

ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

# BIP-44 默认以太坊路径 m/44'/60'/0'/0/0
DEFAULT_HD_PATH = "m/44'/60'/0'/0/0"


# ── EIP-712 Typed Data ───────────────────────────────────────────
# Hyperliquid 的 approveAgent 使用 signUserSignedAction (EIP-712)。
# 结构定义在 @nktkas/hyperliquid 包中:
#   domain: { name: "HyperliquidSignTransaction", version: "1", chainId: 42161, verifyingContract: 0x000...0 }
#   primaryType: "HyperliquidTransaction:ApproveAgent"
#   types: { hyperliquidChain: string, agentAddress: address, agentName: string, nonce: uint64 }
#
# 代码参考: node_modules/@nktkas/hyperliquid/src/src/signing/mod.ts (signUserSignedAction)
# 代码参考: node_modules/@nktkas/hyperliquid/src/src/api/exchange/_methods/approveAgent.ts (ApproveAgentTypes)
# Ref: https://eips.ethereum.org/EIPS/eip-712


def build_typed_data(agent_address: str, agent_name: str, nonce: int) -> dict:
    """构造 EIP-712 typed data，两种签名模式共用。"""
    return {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ],
            "HyperliquidTransaction:ApproveAgent": [
                {"name": "hyperliquidChain", "type": "string"},
                {"name": "agentAddress", "type": "address"},
                {"name": "agentName", "type": "string"},
                {"name": "nonce", "type": "uint64"},
            ],
        },
        "primaryType": "HyperliquidTransaction:ApproveAgent",
        "domain": {
            "name": "HyperliquidSignTransaction",
            "version": "1",
            "chainId": SIGNATURE_CHAIN_ID_INT,
            "verifyingContract": ZERO_ADDRESS,
        },
        "message": {
            "hyperliquidChain": "Mainnet",
            "agentAddress": agent_address,
            "agentName": agent_name,
            "nonce": nonce,
        },
    }


def compute_eip712_hashes(typed_data: dict) -> tuple[bytes, bytes]:
    """用 eth_account 计算 EIP-712 的 domain_hash 和 message_hash。

    返回 (domain_hash, message_hash)，直接传给 ledgereth 的 sign_typed_data_draft。
    encode_typed_data 返回的 SignableMessage: header=domain_hash, body=message_hash。

    eth_account 的 encode_typed_data 签名是 (domain_data, message_types,
    message_data, full_message)——传 full_message 时要求完整的 EIP-712 结构
    （含 types.EIP712Domain / primaryType），build_typed_data 正好构造的就是它。
    """
    signable = encode_typed_data(full_message=typed_data)
    return bytes(signable.header), bytes(signable.body)


# ── 签名模式: Ledger USB ────────────────────────────────────────
# OneKey Pro 兼容 Ledger Ethereum App 的 APDU 协议。
# EIP-712 blind signing 使用 INS=0x0C，需要设备上开启 blind signing。
#
# APDU 格式:
#   CLA=0xE0  INS=0x0C  P1=0x00  P2=0x00
#   Data = [BIP44 path (1+4*n bytes)] [32 bytes domain_hash] [32 bytes message_hash]
#   Response = [1 byte v] [32 bytes r] [32 bytes s]
#
# Ref: https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc
# Ref: ledgereth 库封装了这些 APDU 调用
#
# 注意: OneKey Pro 的 USB Vendor ID (0x1209) 与 Ledger (0x2C97) 不同，
# ledgereth 默认只扫描 Ledger VID。如果连不上，用 --manual 模式。


def sign_with_ledger(typed_data: dict) -> tuple[str, int, bytes, bytes]:
    """通过 USB 连接 Ledger/OneKey Pro 签名 EIP-712 数据。

    返回 (master_address, v, r, s)。
    要求: 设备已连接 USB，Ethereum App 已打开，blind signing 已开启。
    """
    try:
        from ledgereth.comms import init_dongle
        from ledgereth.accounts import get_accounts
        from ledgereth import sign_typed_data_draft
    except ImportError:
        print("缺少 ledgereth 库。安装: pip install ledgereth", file=sys.stderr)
        print("或者改用 --manual 模式。", file=sys.stderr)
        sys.exit(1)

    domain_hash, message_hash = compute_eip712_hashes(typed_data)

    # init_dongle() 内部通过 USB HID 扫描 Ledger 设备
    # 如果 OneKey Pro 的 VID 不被识别，这里会抛异常
    dongle = init_dongle()

    accounts = get_accounts(dongle=dongle, count=1)
    master_address = accounts[0].address
    print(f"硬件钱包地址: {master_address}")
    print("请在设备上确认签名...")

    # sign_typed_data_draft 发送 APDU INS=0x0C
    # 设备会显示 domain_hash 和 message_hash 供用户确认
    sig = sign_typed_data_draft(
        sender_path=DEFAULT_HD_PATH,
        domain_hash=domain_hash,
        message_hash=message_hash,
        dongle=dongle,
    )

    return master_address, sig.v, sig.r, sig.s


# ── 签名模式: 手动（浏览器辅助）────────────────────────────────
# 输出完整 EIP-712 JSON，用户在浏览器控制台用钱包插件签名。
# 适用于 OneKey 浏览器插件、MetaMask（连 OneKey）、或任何支持 eth_signTypedData_v4 的钱包。


def sign_manual(typed_data: dict) -> tuple[str, int, bytes, bytes]:
    """手动签名模式: 输出 EIP-712 JSON，用户在浏览器签名后粘贴回来。

    返回 (master_address, v, r, s)。
    """
    # Ref: https://docs.metamask.io/wallet/reference/eth_signtypeddata_v4/
    typed_data_json = json.dumps(typed_data)

    print("\n" + "=" * 60)
    print("在浏览器控制台（F12）执行以下代码，用你的 OneKey/MetaMask 签名:")
    print("=" * 60)
    print()
    print("// 1. 先拿到你的钱包地址")
    print("const accounts = await ethereum.request({ method: 'eth_requestAccounts' });")
    print("const addr = accounts[0];")
    print("console.log('Master address:', addr);")
    print()
    print("// 2. 签名")
    print(f"const sig = await ethereum.request({{ method: 'eth_signTypedData_v4', params: [addr, '{typed_data_json}'] }});")
    print("console.log('Signature:', sig);")
    print("console.log('Address:', addr);")
    print()
    print("=" * 60)

    master_address = input("\n粘贴 Master address: ").strip()
    if not master_address.startswith("0x") or len(master_address) != 42:
        raise ValueError(f"地址格式错误: {master_address!r}，应为 0x 开头的 42 位十六进制")

    sig_hex = input("粘贴 Signature: ").strip()
    if sig_hex.startswith("0x"):
        sig_hex = sig_hex[2:]
    if len(sig_hex) != 130:
        raise ValueError(f"签名长度错误: {len(sig_hex)}，应为 130 个十六进制字符 (r=64 + s=64 + v=2)")

    r = bytes.fromhex(sig_hex[:64])
    s = bytes.fromhex(sig_hex[64:128])
    v = int(sig_hex[128:130], 16)

    return master_address, v, r, s


# ── 提交到 Hyperliquid API ──────────────────────────────────────
# POST https://api.hyperliquid.xyz/exchange
#
# Request body:
# {
#   "action": {
#     "type": "approveAgent",
#     "signatureChainId": "0xa4b1",
#     "hyperliquidChain": "Mainnet",
#     "agentAddress": "0x...",
#     "agentName": "xxx valid_until 1234567890123",
#     "nonce": 1234567890123
#   },
#   "nonce": 1234567890123,
#   "signature": { "r": "0x...", "s": "0x...", "v": 27 }
# }
#
# Response (成功): {"status": "ok", "response": {"type": "default"}}
# Response (失败): {"status": "err", "response": "error message"}
#
# Ref: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint#approve-an-api-wallet


def submit_approval(
    agent_address: str,
    agent_name: str,
    nonce: int,
    v: int,
    r: bytes,
    s: bytes,
) -> dict:
    """提交 approveAgent 到 Hyperliquid。失败直接抛异常，不兜底。"""
    action = {
        "type": "approveAgent",
        "signatureChainId": SIGNATURE_CHAIN_ID,
        "hyperliquidChain": "Mainnet",
        "agentAddress": agent_address,
        "agentName": agent_name,
        "nonce": nonce,
    }

    signature = {
        "r": "0x" + r.hex(),
        "s": "0x" + s.hex(),
        "v": v,
    }

    payload = {
        "action": action,
        "nonce": nonce,
        "signature": signature,
    }

    # 不设 timeout fallback，网络挂了就让 requests 自己报 ConnectionError
    resp = requests.post(EXCHANGE_API, json=payload, timeout=30)

    # HTTP 层失败: 直接抛，暴露状态码和 response body
    if not resp.ok:
        raise RuntimeError(
            f"HTTP {resp.status_code} {resp.reason}\n"
            f"Response body: {resp.text}"
        )

    data = resp.json()

    # API 层失败: Hyperliquid 返回 status != "ok"
    if data.get("status") != "ok":
        raise RuntimeError(
            f"Hyperliquid API 返回非 ok 状态\n"
            f"完整响应: {json.dumps(data, indent=2)}"
        )

    return data


# ── 保存 Agent Key ──────────────────────────────────────────────


def save_agent_key(
    output_path: Path,
    master_address: str,
    agent_private_key: str,
    agent_address: str,
    agent_name: str,
    nonce: int,
    expires_at: int,
) -> None:
    """将 agent 私钥和元信息写入 JSON 文件。"""
    data = {
        "master_address": master_address,
        "agent_address": agent_address,
        "agent_private_key": agent_private_key,
        "agent_name": agent_name,
        "nonce": nonce,
        "expires_at_ms": expires_at,
        "expires_at_human": time.strftime(
            "%Y-%m-%d %H:%M:%S UTC", time.gmtime(expires_at / 1000)
        ),
    }
    output_path.write_text(json.dumps(data, indent=2) + "\n")


# ── Main ────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="用硬件钱包批准 Hyperliquid Agent Wallet",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--days", type=int, required=True,
        help="Agent 有效天数（写入 agentName 的 valid_until 时间戳）",
    )

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--ledger", action="store_true", help="USB 直连硬件钱包签名（Ledger 协议）")
    mode.add_argument("--manual", action="store_true", help="浏览器辅助签名（输出 EIP-712 JSON）")

    parser.add_argument(
        "--output", type=str, default="agent_key.json",
        help="Agent 私钥输出文件路径（默认 agent_key.json）",
    )
    parser.add_argument(
        "--name", type=str, default="hyperfront",
        help="Agent 名称前缀（默认 hyperfront，最长 16 字符）",
    )

    args = parser.parse_args()

    # 校验 agent name 长度
    # Ref: ApproveAgentRequest 中 agentName 校验: base name 1-16 字符
    if len(args.name) < 1 or len(args.name) > 16:
        print(f"错误: --name 长度必须 1-16 字符，当前 {len(args.name)}: {args.name!r}", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output)
    if output_path.exists():
        print(f"错误: 输出文件已存在: {output_path}", file=sys.stderr)
        print("请删除或指定其他路径，防止覆盖已有 agent key。", file=sys.stderr)
        sys.exit(1)

    # ── 1. 生成 Agent 私钥 ──
    agent_private_key = "0x" + secrets.token_hex(32)
    agent_account = Account.from_key(agent_private_key)
    agent_address = agent_account.address.lower()  # Hyperliquid 要求小写地址

    print(f"Agent 地址: {agent_address}")

    # ── 2. 构造 approveAgent 参数 ──
    # nonce = 当前毫秒时间戳，action.nonce 和外层 nonce 必须一致
    # Ref: agent_wallet.md "nonce: current timestamp in milliseconds, must match nonce in outer request body"
    nonce = int(time.time() * 1000)

    # valid_until 写入 agentName，格式: "<name> valid_until <expires_at_ms>"
    # Ref: ApproveAgentRequest.agentName 支持 trailing " valid_until <timestamp>"
    expires_at = nonce + args.days * 24 * 60 * 60 * 1000
    agent_name = f"{args.name} valid_until {expires_at}"

    print(f"Agent 名称: {agent_name}")
    print(f"有效期至: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime(expires_at / 1000))}")

    # ── 3. 签名 ──
    typed_data = build_typed_data(agent_address, agent_name, nonce)

    if args.ledger:
        master_address, v, r, s = sign_with_ledger(typed_data)
    else:
        master_address, v, r, s = sign_manual(typed_data)

    print(f"\nMaster 地址: {master_address}")
    print(f"签名: v={v} r=0x{r.hex()[:16]}... s=0x{s.hex()[:16]}...")

    # ── 4. 提交到 Hyperliquid ──
    print("\n提交 approveAgent 到 Hyperliquid...")
    result = submit_approval(agent_address, agent_name, nonce, v, r, s)
    print(f"成功! 响应: {json.dumps(result)}")

    # ── 5. 保存 Agent Key ──
    save_agent_key(output_path, master_address, agent_private_key, agent_address, agent_name, nonce, expires_at)
    print(f"\nAgent 私钥已保存: {output_path}")
    print(f"⚠ 请妥善保管此文件，其中包含 agent 私钥!")
    print(f"⚠ Agent 只能签名交易（下单/撤单），不能提币。")
    print(f"⚠ 到期后需重新运行此脚本生成新 agent。不要复用旧 agent 地址。")
    # Ref: agent_wallet.md "it is strongly suggested to not reuse their addresses.
    #   Once an agent is deregistered, its used nonce state may be pruned."


if __name__ == "__main__":
    main()

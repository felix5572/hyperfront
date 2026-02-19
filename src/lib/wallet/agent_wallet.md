Approve an API wallet  批准 API 钱包
POST https://api.hyperliquid.xyz/exchange

Approves an API Wallet (also sometimes referred to as an Agent Wallet). See here for more details.
批准一个 API 钱包（有时也称为代理钱包）。详情请参阅此处。

Headers  请求头

Name  名称
Value  值
Content-Type*

application/json

Body  正文

Name  名称
Type  类型
Description  描述
action*

Object  对象

{
  "type": "approveAgent",
{
"type": "approveAgent",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),
  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,
  "hyperliquidChain": "Mainnet"（在测试网请使用 "Testnet"），
  "signatureChainId": 签名时所用链的十六进制格式 ID；例如 Arbitrum 为 "0xa4b1"，

  "agentAddress": address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000,
"agentAddress": 42 位十六进制格式的地址；例如 0x0000000000000000000000000000000000000000，

"agentName": Optional name for the API wallet. An account can have 1 unnamed approved wallet and up to 3 named ones. And additional 2 named agents are allowed per subaccount,
"agentName": API 钱包的可选名称。一个账户可以拥有 1 个未命名的已批准钱包和最多 3 个已命名的钱包。此外，每个子账户允许额外拥有 2 个已命名的代理，

  "nonce": current timestamp in milliseconds as a Number, must match nonce in outer request body
"nonce": 以数字形式表示的当前毫秒级时间戳，必须与外部请求体中的 nonce 一致

}

nonce*

number  数字

Recommended to use the current timestamp in milliseconds
建议使用当前毫秒级时间戳

signature*

Object  对象

Response  响应

200

Copy  复制
{'status': 'ok', 'response': {'type': 'default'}}


API wallets  API 钱包
These are also known as agent wallets in the docs. A master account can approve API wallets to sign on behalf of the master account or any of the sub-accounts. 
在文档中，这些也被称为 agent wallets 。主账户可以批准 API 钱包代表主账户或任何子账户进行签名。

Note that API wallets are only used to sign. To query the account data associated with a master or sub-account, you must pass in the actual address of that account. A common pitfall is to use the agent wallet which leads to an empty result.
请注意，API 钱包仅用于签名。要查询与主账户或子账户关联的账户数据，必须传入该账户的实际地址。一个常见的错误是使用代理钱包，这会导致查询结果为空。

API wallet pruning  API 钱包清理
API wallets and their associated nonce state may be pruned in the following cases:
API 钱包及其相关的 nonce 状态在以下情况下可能会被清理：

The wallet is deregistered. This happens to an existing unnamed API Wallet when an ApproveAgent action is sent to register a new unnamed API Wallet. This also happens to an existing named API Wallet when an ApproveAgent action is sent with a matching name.
钱包被注销。当发送 ApproveAgent 操作以注册一个新的未命名 API 钱包时，现有的未命名 API 钱包会被注销。当发送带有匹配名称的 ApproveAgent 操作时，现有的同名 API 钱包也会被注销。

The wallet expires.  钱包过期。

The account that registered the agent no longer has funds.
注册该代理的账户已无资金。

Important: for those using API wallets programmatically, it is strongly suggested to not reuse their addresses. Once an agent is deregistered, its used nonce state may be pruned. Generate a new agent wallet on future use to avoid unexpected behavior. For example, previously signed actions can be replayed once the nonce set is pruned.
重要提示：对于以编程方式使用 API 钱包的用户，强烈建议不要重复使用其地址。一旦代理（agent）被注销，其已使用的 nonce 状态可能会被修剪。在未来使用时请生成新的代理钱包，以避免意外行为。例如，一旦 nonce 集合被修剪，之前签署的操作可能会被重放。

Hyperliquid nonces   Hyperliquid nonce 机制
Ethereum's design does not work for an onchain order book. A market making strategy can send thousands of orders and cancels in a second. Requiring a precise ordering of inclusion on the blockchain will break any strategy.
Ethereum 的设计并不适用于链上订单簿。做市策略可能在一秒钟内发送数千个订单和取消指令。如果要求在区块链上精确排序，将会破坏任何交易策略。

On Hyperliquid, the 100 highest nonces are stored per address. Every new transaction must have nonce larger than the smallest nonce in this set and also never have been used before. Nonces are tracked per signer, which is the user address if signed with private key of the address, or the agent address if signed with an API wallet. 
在 Hyperliquid 上，每个地址会存储 100 个最大的 nonce。每笔新交易的 nonce 必须大于该集合中的最小值，且从未被使用过。Nonce 是按签名者追踪的：如果使用地址的私钥签名，则签名者为用户地址；如果使用 API 钱包签名，则签名者为代理地址。

Nonces must be within (T - 2 days, T + 1 day), where T is the unix millisecond timestamp on the block of the transaction.
随机数（Nonce）必须在 (T - 2 days, T + 1 day) 范围内，其中 T 是该交易所在区块的 Unix 毫秒时间戳。

The following steps may help port over an automated strategy from a centralized exchange:
以下步骤可能有助于从中心化交易所迁移自动化策略：

Use a API wallet per trading process. Note that nonces are stored per signer (i.e. private key), so separate subaccounts signed by the same API wallet will share the nonce tracker of the API wallet. It's recommended to use separate API wallets for different subaccounts.
每个交易进程使用一个 API 钱包。请注意，随机数是按签名者（即私钥）存储的，因此由同一个 API 钱包签名的不同子账户将共享该 API 钱包的随机数追踪器。建议为不同的子账户使用独立的 API 钱包。

In each trading process, have a task that periodically batches order and cancel requests every 0.1 seconds. It is recommended to batch IOC and GTC orders separately from ALO orders because ALO order-only batches are prioritized by the validators.
在每个交易进程中，设置一个任务每隔 0.1 秒定期批量处理下单和撤单请求。建议将 IOC 和 GTC 订单与 ALO 订单分开批量处理，因为仅包含 ALO 订单的批次会被验证者优先处理。

The trading logic tasks send orders and cancels to the batching task.
交易逻辑任务将订单和取消指令发送给批处理任务。

For each batch of orders or cancels, fetch and increment an atomic counter that ensures a unique nonce for the address. The atomic counter can be fast-forwarded to current unix milliseconds if needed.
对于每一批订单或取消指令，获取并递增一个原子计数器，以确保该地址拥有唯一的 nonce。如有需要，原子计数器可以快进到当前的 Unix 毫秒时间戳。

This structure is robust to out-of-order transactions within 2 seconds, which should be sufficient for an automated strategy geographically near an API server.
这种结构对于 2 秒内的乱序交易具有鲁棒性，对于地理位置靠近 API 服务器的自动化策略来说，这应该是足够的。

Suggestions for subaccount and vault users
针对子账户和金库用户的建议
Note that nonces are stored per signer, which is the address of the private key used to sign the transaction. Therefore, it's recommended that each trading process or frontend session use a separate private key for signing. In particular, a single API wallet signing for a user, vault, or subaccount all share the same nonce set.
请注意，nonce 是按签名者存储的，即用于签署交易的私钥地址。因此，建议每个交易进程或前端会话使用独立的私钥进行签名。特别需要注意的是，如果单个 API 钱包同时为用户、金库或子账户进行签名，它们将共享同一套 nonce 序列。

If users want to use multiple subaccounts in parallel, it would easier to generate two separate API wallets under the master account, and use one API wallet for each subaccount. This avoids collisions between the nonce set used by each subaccount.
如果用户希望并行使用多个子账户，更简便的方法是在主账户下生成两个独立的 API 钱包，并为每个子账户分别使用一个 API 钱包。这样可以避免各子账户之间因使用同一套 nonce 序列而产生的冲突。
# Web3 + FHE 架构模式

fhEVM（Fully Homomorphic Ethereum Virtual Machine）是由 Zama 开发的开源项目，旨在让以太坊及兼容 EVM 的链上智能合约能够处理加密数据，从而实现隐私保护。传统的 FHE 计算非常耗资源，直接放在链上执行会导致 gas 成本过高且严重拖慢出块速度，因此 fhEVM 采用了"链下计算 + 链上验证"的 Coprocessor 架构：用户将用全局公钥加密后的数据连同 ZKPoK 零知识证明发送到链上，Solidity 合约中只存储密文句柄而非实际密文，Coprocessor 链下监听事件获取密文并执行实际的 FHE 运算（加、减、乘、比较等），结果密文再提交回链上。fhEVM 底层使用 TFHE [方案](https://docs.zama.org/tfhe-rs/get-started/security-and-cryptography)，该方案对每个门操作后自动触发轻量级 Bootstrapping 以防止噪声积累，这意味着开发者写 Solidity 合约时不需要手动管理噪声，只需要使用 euint32、euint256 等加密类型即可。解密过程采用 MPC + 门限密码学，由 Gateway 和 KMS（密钥管理节点）协调多个节点协作完成，没有任何单点能够单独解密数据。fhEVM 还内置了 ACL（访问控制列表）系统管理"谁能解密哪个密文"，确保只有授权地址才能请求解密。代表性的应用场景包括私密 ERC-20 代币、密封拍卖、私密投票以及链上机器学习推理等。

---

## fhEVM 的 Coprocessor 架构

![fhEVM Architecture](/img/FHE_arc.png)

---

## 数据流：一笔私密转账的完整路径

以私密 ERC-20 转账为例，走完整流程：

### 1. 用户加密输入（链下）

```ts
// 用户想转账 100 个代币，但不想让别人知道金额
const { handles, inputProof } = await fhevm
  .createEncryptedInput(contractAddress, userAddress)
  .add32(100)        // 加密整数 100
  .encrypt();        // 生成密文 + ZKPoK 证明

// handles[0] 是密文句柄（32 bytes）
// inputProof 是 ZK 证明，证明用户知道 100 这个值
```

### 2. 发送交易（链上）

```solidity
// 合约接收加密转账金额
function transfer(
    address to,
    externalEuint32 encryptedAmount,
    bytes calldata inputProof
) external {
    // 验证 ZKPoK，把外部密文转为链上可操作的 euint32
    euint32 amount = FHE.fromExternal(encryptedAmount, inputProof);

    // 同态减法：扣除发送方余额
    _balances[msg.sender] = FHE.sub(_balances[msg.sender], amount);

    // 同态加法：增加接收方余额
    _balances[to] = FHE.add(_balances[to], amount);

    // 授权双方都能查看自己的余额
    FHE.allowThis(_balances[msg.sender]);
    FHE.allow(_balances[msg.sender], msg.sender);
    FHE.allowThis(_balances[to]);
    FHE.allow(_balances[to], to);

    // 此时 Executor 合约广播事件，通知 Coprocessor 执行实际 FHE 运算
}
```

### 3. Coprocessor 异步计算（链下）

Coprocessor 监听到事件后，在链下执行真正的 FHE 加减运算，把新的密文结果提交回链上。**这个过程对开发者透明**，你不需要直接与 Coprocessor 交互。

### 4. 用户查看余额（链下解密）

```ts
// 读取链上的密文句柄
const encryptedBalance = await contract.balanceOf(userAddress);

// 向 Gateway 请求解密（Gateway 会检查 ACL，只有 msg.sender 有权限）
const clearBalance = await fhevm.decrypt32(contractAddress, encryptedBalance);

console.log("你的余额：", clearBalance); // 明文余额，只有你能看到
```

---

## 关键设计原则

### 原则 1：链上只存句柄

密文本身可以非常大（几 KB 到几十 KB），不适合存在链上。链上只存一个 32 字节的句柄（handle），实际密文由 Coprocessor 管理。

### 原则 2：ACL 是权限边界

任何对密文的访问（无论是合约内使用还是用户解密）都要通过 ACL 授权。忘记 `allowThis` 是最常见的 bug，会导致下一次交易访问密文时被拒绝。

### 原则 3：解密是异步的

链上不会即时返回明文。解密请求发出后，需要等待 Gateway 协调 KMS 节点，然后结果以回调或链下查询的方式返回。这意味着：

- **合约逻辑里不能依赖"立即解密"**
- 需要结果的地方（如前端展示余额），在链下调用解密接口

### 原则 4：全局公钥 = 密文互操作

所有用户的加密输入都用同一个全局公钥加密，这使得：

```solidity
// 不同用户的余额密文可以直接相加，无需解密中间值
_balances[to] = FHE.add(_balances[from], _balances[extra]);
```

这是 fhEVM 实现复合 DeFi 逻辑的关键基础。

---

## 与其他隐私方案的对比

| 方案 | 链上计算 | 数据隐私 | 可组合性 | 典型代表 |
|------|----------|----------|----------|----------|
| fhEVM（Coprocessor）| 链下 FHE + 链上验证 | 完全加密 | 高（共用公钥）| Zama, Fhenix |
| ZK Rollup | 链下执行 + 链上 ZK 证明 | 有限 | 中 | zkSync, StarkNet |
| TEE（可信执行环境）| TEE 内部执行 | 依赖硬件信任 | 中 | Secret Network |
| MPC | 多方协同计算 | 高 | 低（需要在线交互）| 各种 MPC 方案 |

---

## 延伸阅读

- [Zama Confidential Blockchain Protocol Litepaper](https://docs.zama.org/protocol/zama-protocol-litepaper)
- [fhEVM Protocol Overview](https://docs.zama.org/protocol/protocol/overview)
- [Fhenix 技术博客](https://www.fhenix.io/blog)
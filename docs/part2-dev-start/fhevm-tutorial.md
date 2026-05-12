# fhEVM 实战：从普通合约到隐私合约

> 本教程以一个简单的计数器合约为例，演示如何把普通 Solidity 合约改造成 fhEVM 隐私合约。完成后你将理解：加密类型、加密输入、ACL 权限控制、以及如何在链下读取加密状态。

## 前置要求

- 熟悉 Solidity 基础
- 安装 Node.js 18+、npm
- 了解 Hardhat（不了解可以先看 [Hardhat 快速入门](https://hardhat.org/getting-started/)）

---

## 第一步：初始化项目

```bash
mkdir fhe-counter && cd fhe-counter
npx hardhat init
# 选择 "Create a TypeScript project"

# 安装 fhEVM 依赖
npm install @zama-network/hardhat-fhevm fhevmjs
```

在 `hardhat.config.ts` 中添加插件：

```ts
import "@zama-network/hardhat-fhevm";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      fhevm: {
        // 本地开发模式，无需真实 FHE 运算
        mode: "mocked",
      },
    },
  },
};
```

---

## 第二步：写一个普通计数器

先写不加密的版本，理解基础逻辑：

```solidity
// contracts/Counter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Counter {
    uint32 private _count;

    function increment(uint32 value) external {
        _count += value;
    }

    function decrement(uint32 value) external {
        require(_count >= value, "cannot decrement below zero");
        _count -= value;
    }

    function getCount() external view returns (uint32) {
        return _count;
    }
}
```

问题：`_count` 是公开的，任何人都能查看。

---

## 第三步：改造为 fhEVM 隐私合约

```solidity
// contracts/FHECounter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@zama-network/fhevm-contracts/contracts/FHE.sol";
import { ZamaEthereumConfig } from "@zama-network/fhevm-contracts/contracts/config/ZamaEthereumConfig.sol";

contract FHECounter is ZamaEthereumConfig {
    // 原来是 uint32，现在是加密整数
    euint32 private _count;

    // 关键改变 1：输入从 uint32 变成 externalEuint32
    // externalEuint32 是用户在链下用全局公钥加密的值
    function increment(
        externalEuint32 inputValue,
        bytes calldata inputProof   // ZK 证明：用户确实知道这个值
    ) external {
        // 关键改变 2：将外部密文转为合约内可操作的 euint32
        euint32 evalue = FHE.fromExternal(inputValue, inputProof);

        // 加法操作：直接在密文上运算，无需解密
        _count = FHE.add(_count, evalue);

        // 关键改变 3：授权访问控制
        // 允许合约自身在后续交易中访问 _count
        FHE.allowThis(_count);
        // 允许调用者在链下解密查看结果
        FHE.allow(_count, msg.sender);
    }

    function decrement(
        externalEuint32 inputValue,
        bytes calldata inputProof
    ) external {
        euint32 evalue = FHE.fromExternal(inputValue, inputProof);
        _count = FHE.sub(_count, evalue);
        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);
    }

    // 返回的是密文句柄，不是明文
    // 只有被 ACL 授权的地址才能在链下解密
    function getCount() external view returns (euint32) {
        return _count;
    }
}
```

### 改动要点总结

| 普通合约 | fhEVM 合约 | 说明 |
|----------|------------|------|
| `uint32 _count` | `euint32 _count` | 状态变量加密存储 |
| `function f(uint32 v)` | `function f(externalEuint32 v, bytes calldata proof)` | 输入必须是加密值 + ZK 证明 |
| `_count += value` | `_count = FHE.add(_count, evalue)` | 同态运算替代明文运算 |
| 无需权限控制 | `FHE.allowThis / FHE.allow` | 显式声明谁可以解密 |

---

## 第四步：在测试中与合约交互

```ts
// test/FHECounter.ts
import { ethers } from "hardhat";
import { createInstance } from "fhevmjs";

async function main() {
  const [deployer, user] = await ethers.getSigners();

  // 部署合约
  const FHECounter = await ethers.getContractFactory("FHECounter");
  const counter = await FHECounter.deploy();

  // 创建 fhEVM 实例（处理加密/解密）
  const fhevm = await createInstance();

  // 在链下加密输入值 5
  const { handles, inputProof } = await fhevm.createEncryptedInput(
    await counter.getAddress(),
    user.address
  ).add32(5).encrypt();

  // 发送加密交易
  await counter.connect(user).increment(handles[0], inputProof);

  // 读取加密的计数器值（返回密文句柄）
  const encryptedCount = await counter.getCount();

  // 在链下解密（只有被授权的地址才能成功）
  const clearCount = await fhevm.decrypt32(
    await counter.getAddress(),
    encryptedCount
  );

  console.log("解密后的计数器值:", clearCount); // 应该是 5
}
```

---

## 第五步：部署到测试网

```bash
# 配置环境变量
export PRIVATE_KEY="your_private_key"

# 部署到 Sepolia（Zama 的测试网）
npx hardhat run scripts/deploy.ts --network sepolia
```

`hardhat.config.ts` 添加 Sepolia 网络配置：

```ts
networks: {
  sepolia: {
    url: "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY",
    accounts: [process.env.PRIVATE_KEY!],
  },
},
```

---

## 理解 ACL 权限控制

ACL（访问控制列表）是 fhEVM 中管理"谁能解密什么"的系统：

```solidity
// 永久授权：合约自身在所有后续交易中可以访问此密文
FHE.allowThis(encryptedValue);

// 永久授权：特定地址可以在链下解密
FHE.allow(encryptedValue, someAddress);

// 临时授权：仅在当前交易内有效
FHE.allowTransient(encryptedValue, someAddress);
```

> **warning** 一个常见错误：忘记调用 `FHE.allowThis()`，导致合约在下一次交易里无法再使用这个密文（权限校验失败）。

---

## 下一步：更复杂的场景

掌握计数器之后，可以尝试：

- **私密投票**：`euint32` 统计各候选人票数，投票期间对所有人保密
- **密封拍卖**：用 `FHE.lt()` 比较加密出价，确定最高竞拍者
- **私密 ERC-20**：参考 [Zama ConfidentialERC20 示例](https://github.com/zama-ai/fhevm/tree/main/examples)

---

## 参考资料

- [Zama fhEVM 官方文档](https://docs.zama.org/protocol/solidity-guides)
- [fhEVM GitHub examples](https://github.com/zama-ai/fhevm/tree/main/examples)
- [fhEVM Quick Start Tutorial](https://docs.zama.org/protocol/solidity-guides/getting-started/quick-start-tutorial/turn_it_into_fhevm)
- [Zama 视频教程](https://www.zama.org/post/video-tutorial-how-to-write-confidential-smart-contracts-using-zamas-fhevm)
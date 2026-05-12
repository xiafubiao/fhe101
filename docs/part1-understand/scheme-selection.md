# FHE Scheme 选型指南

> 对 Web3 开发者来说，"我该用哪个 FHE 方案"几乎是接触这门技术后的第一个问题。本文帮你建立选型直觉。

## 主流 Scheme 一览

目前工业界主流的 FHE Scheme 有四个，按技术血统分两大家族：

| Scheme | 数据类型 | 典型场景 | 代表库 |
|--------|----------|----------|--------|
| **BFV** | 整数向量 | 链上整数运算、投票计数 | Microsoft SEAL, OpenFHE |
| **BGV** | 整数向量 | 与 BFV 相近，深层电路略优 | OpenFHE, HElib |
| **CKKS** | 浮点数（近似） | 机器学习推理、统计计算 | SEAL, OpenFHE |
| **TFHE / CGGI** | 布尔值 / 小整数 | 任意函数、条件分支、比较运算 | TFHE-rs（Zama）, OpenFHE |

---

## 选型决策树

```
你的数据是什么类型？
│
├── 整数（余额、投票数、计数器）
│   └── 运算深度深（乘法多）吗？
│       ├── 是 → BGV
│       └── 否 → BFV
│
├── 浮点数 / 近似计算（ML 推理、风险评分）
│   └── CKKS
│
└── 需要条件分支 / 比较 / 任意函数？
    └── TFHE（Web3 里 Zama 的 fhEVM 用的就是这个）
```

---

## 各 Scheme 核心特点

### BFV / BGV —— 整数算术

- **明文空间**：整数模 t（一个质数），支持打包（SIMD 风格，一个密文装多个整数槽）
- **优势**：精确计算，无近似误差
- **限制**：乘法次数受"乘法深度"限制，深层电路需要 bootstrapping
- **Web3 典型用途**：私密投票（统计票数）、链上加法累加

BFV 和 BGV 的差异很小，选哪个主要看你用的库——如果用 SEAL，选 BFV；如果用 OpenFHE，两个都支持，BGV 在深层电路下效率略好。

### CKKS —— 近似浮点

- **明文空间**：复数 / 实数，结果是**近似值**（存在精度误差）
- **优势**：对 ML 推理非常高效，支持打包
- **限制**：不能用于需要精确结果的场景（如余额计算）
- **Web3 典型用途**：链下隐私 ML 推理（如信用评分、欺诈检测）

> **warning** CKKS 的近似误差在某些场景下是安全风险。用于金融类精确计算时请优先考虑 BFV/BGV。

### TFHE / CGGI —— 布尔电路 / 任意函数

- **明文空间**：单比特（布尔）或小整数
- **优势**：每个门操作后自动 bootstrapping（噪声不会积累），可以实现任意函数、条件分支、比较运算
- **限制**：单个操作延迟高（~10ms/门级），不适合大批量算术
- **Web3 典型用途**：这是 **fhEVM（Zama）的底层方案**，支持 `euint` 类型上的完整算术和比较操作

TFHE 是目前 Web3 领域使用最广泛的 FHE 方案，因为它支持任意函数求值，对智能合约逻辑最友好。

---

## Web3 场景选型建议

| 场景 | 推荐方案 | 理由 |
|------|----------|------|
| 写 fhEVM 智能合约 | TFHE（via fhEVM 库） | fhEVM 底层就是 TFHE，开箱即用 |
| 链下隐私计算 + 结果上链 | BFV / TFHE | 看是否需要条件分支 |
| 私密 ML 推理 | CKKS | 浮点场景的最优解 |
| 密封拍卖 / 私密投票 | TFHE（fhEVM）| 需要比较运算，TFHE 原生支持 |
| 私密余额 / 代币 | TFHE（fhEVM）| 参考 Zama 的 ConfidentialERC20 |

---

## 关于性能的直觉

FHE 目前比明文计算慢很多，这是你在选型时必须接受的现实：

- **TFHE**：单个布尔门 ~10ms（CPU），~0.1ms（GPU）。实际应用中，简单的加减乘通常在秒级内完成
- **BFV/BGV**：批量整数运算效率更高，打包后摊薄成本
- **CKKS**：神经网络推理场景下通常是最快的

> **tip** 一个实用原则：**如果你用 fhEVM 写 Solidity 合约**，不需要直接关心底层延迟——fhEVM 的 Coprocessor 在链下异步执行 FHE 运算，链上只需等待结果。

---

## 延伸阅读

- [FHE Scheme Comparison（fhetextbook.github.io）](https://fhetextbook.github.io/FHESchemeComparisonandSummary.html)
- [A High-Level Technical Overview of FHE（Jeremy Kun）](https://www.jeremykun.com/2024/05/04/fhe-overview/)
- [OpenFHE 文档](https://openfhe-development.readthedocs.io/)
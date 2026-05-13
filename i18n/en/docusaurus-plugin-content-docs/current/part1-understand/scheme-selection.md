# FHE Scheme Selection Guide

> For Web3 developers, "which FHE scheme should I use" is almost the first question after encountering this technology. This article helps you build selection intuition.

## Overview of Mainstream Schemes

Currently, there are four mainstream FHE schemes in the industry, divided into two families by technical lineage:

| Scheme | Data Type | Typical Scenarios | Representative Libraries |
|--------|----------|----------|--------|
| **BFV** | Integer vectors | On-chain integer operations, vote counting | Microsoft SEAL, OpenFHE |
| **BGV** | Integer vectors | Similar to BFV, slightly better for deep circuits | OpenFHE, HElib |
| **CKKS** | Floating-point (approximate) | Machine learning inference, statistical computation | SEAL, OpenFHE |
| **TFHE / CGGI** | Boolean / small integers | Arbitrary functions, conditional branches, comparison operations | TFHE-rs (Zama), OpenFHE |

---

## Selection Decision Tree

```
What type is your data?
│
├── Integer (balance, vote count, counter)
│   └── Is the operation depth deep (many multiplications)?
│       ├── Yes → BGV
│       └── No → BFV
│
├── Floating-point / approximate computation (ML inference, risk scoring)
│   └── CKKS
│
└── Need conditional branches / comparisons / arbitrary functions?
    └── TFHE (this is what Zama's fhEVM uses in Web3)
```

---

## Core Characteristics of Each Scheme

### BFV / BGV — Integer Arithmetic

- **Plaintext space**: Integer modulo t (a prime), supports packing (SIMD-style, one ciphertext holds multiple integer slots)
- **Advantage**: Exact computation, no approximation error
- **Limitation**: Multiplication count limited by "multiplicative depth," deep circuits require bootstrapping
- **Typical Web3 use cases**: Private voting (counting votes), on-chain addition accumulation

BFV and BGV have very small differences. Which one to choose mainly depends on the library you use — if using SEAL, choose BFV; if using OpenFHE, both are supported, and BGV is slightly more efficient for deep circuits.

### CKKS — Approximate Floating-Point

- **Plaintext space**: Complex/real numbers, result is **approximate** (has precision error)
- **Advantage**: Very efficient for ML inference, supports packing
- **Limitation**: Cannot be used for scenarios requiring exact results (like balance computation)
- **Typical Web3 use cases**: Off-chain private ML inference (credit scoring, fraud detection)

> **warning** CKKS approximation errors can be a security risk in certain scenarios. For financial-type precise calculations, prefer BFV/BGV.

### TFHE / CGGI — Boolean Circuits / Arbitrary Functions

- **Plaintext space**: Single bit (boolean) or small integer
- **Advantage**: Automatic bootstrapping after each gate operation (noise doesn't accumulate), can implement arbitrary functions, conditional branches, comparison operations
- **Limitation**: Single operation latency is high (~10ms/gate), not suitable for large-scale arithmetic
- **Typical Web3 use cases**: This is the **underlying scheme for fhEVM (Zama)**, supports complete arithmetic and comparison operations on `euint` types

TFHE is currently the most widely used FHE scheme in the Web3 field because it supports arbitrary function evaluation, making it the most friendly for smart contract logic.

---

## Web3 Scenario Selection Recommendations

| Scenario | Recommended Scheme | Reason |
|------|----------|------|
| Writing fhEVM smart contracts | TFHE (via fhEVM library) | fhEVM is built on TFHE, works out of the box |
| Off-chain private computation + results on-chain | BFV / TFHE | Depends on whether you need conditional branches |
| Private ML inference | CKKS | Best solution for floating-point scenarios |
| Sealed auction / Private voting | TFHE (fhEVM) | Needs comparison operations, TFHE natively supports |
| Private balance / tokens | TFHE (fhEVM) | See Zama's ConfidentialERC20 |

---

## Performance Intuition

FHE is currently much slower than plaintext computation. This is a reality you must accept when selecting:

- **TFHE**: Single boolean gate ~10ms (CPU), ~0.1ms (GPU). In practical applications, simple addition/subtraction/multiplication usually completes within seconds
- **BFV/BGV**: Batch integer operations are more efficient, costs amortized after packing
- **CKKS**: Usually the fastest in neural network inference scenarios

> **tip** A practical principle: **If you're writing Solidity contracts with fhEVM**, you don't need to care about the underlying latency directly — fhEVM's Coprocessor asynchronously executes FHE operations off-chain, and the chain only waits for results.

---

## Further Reading

- [FHE Scheme Comparison (fhetextbook.github.io)](https://fhetextbook.github.io/FHESchemeComparisonandSummary.html)
- [A High-Level Technical Overview of FHE (Jeremy Kun)](https://www.jeremykun.com/2024/05/04/fhe-overview/)
- [OpenFHE Documentation](https://openfhe-development.readthedocs.io/)
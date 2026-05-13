# Web3 + FHE Architecture Patterns

> Running FHE computation directly on-chain is currently impractical — Ethereum's gas model and block time simply can't support it. This article introduces the mainstream architecture for FHE in Web3 scenarios: the **Coprocessor pattern**, and the data flow you need to understand as a developer.

## Why Can't FHE Run On-Chain?

A simple FHE multiplication takes milliseconds to hundreds of milliseconds on CPU. If executed on-chain, gas costs would be astronomical and severely slow down block production.

The solution: **Only store ciphertext handles on-chain, actual FHE computation is done off-chain by the Coprocessor**.

---

## fhEVM's Coprocessor Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          User (Browser/Client)                      │
│                                                                  │
│  1. Encrypt input values with global public key                    │
│  2. Generate ZKPoK (zero-knowledge proof: I know this value)      │
│  3. Package (ciphertext, ZKPoK) and send to chain                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Host Chain (Ethereum / L2)                  │
│                                                                  │
│  Smart Contract (your Solidity code)                                 │
│  ┌─────────────────────────────────────────┐                    │
│  │ function transfer(externalEuint32 amt,  │                    │
│  │                   bytes proof) {        │                    │
│  │   euint32 e = FHE.fromExternal(amt,     │ ── On-chain stores  │
│  │                                proof); │    ciphertext handle │
│  │   _balance = FHE.sub(_balance, e);      │    not ciphertext  │
│  │   FHE.allowThis(_balance);             │                    │
│  │ }                                      │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  ACL Contract: Records "who can decrypt which ciphertext"            │
│  FHEVM Executor: Broadcasts FHE operations as events                │
└────────────────────────────┬────────────────────────────────────┘
                             │  Events (FHE operation requests)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Coprocessor (Off-Chain)                      │
│                                                                  │
│  - Listens to on-chain FHE operation events                         │
│  - Retrieves ciphertext, executes actual FHE operations (+/-/×/compare)│
│  - Submits result ciphertext back to chain                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Gateway + KMS (Key Management)                      │
│                                                                  │
│  - Verify ACL: Check if requesting address has permission           │
│  - Coordinate threshold decryption among multiple KMS nodes (MPC)    │
│  - Return plaintext result to authorized user                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Complete Path of a Private Transfer

Taking a private ERC-20 transfer as an example, through the complete process:

### 1. User Encrypts Input (Off-Chain)

```ts
// User wants to transfer 100 tokens but doesn't want others to know the amount
const { handles, inputProof } = await fhevm
  .createEncryptedInput(contractAddress, userAddress)
  .add32(100)        // Encrypt integer 100
  .encrypt();        // Generate ciphertext + ZKPoK proof

// handles[0] is the ciphertext handle (32 bytes)
// inputProof is the ZK proof, proving user knows the value 100
```

### 2. Send Transaction (On-Chain)

```solidity
// Contract receives encrypted transfer amount
function transfer(
    address to,
    externalEuint32 encryptedAmount,
    bytes calldata inputProof
) external {
    // Verify ZKPoK, convert external ciphertext to on-chain operable euint32
    euint32 amount = FHE.fromExternal(encryptedAmount, inputProof);

    // Homomorphic subtraction: deduct sender's balance
    _balances[msg.sender] = FHE.sub(_balances[msg.sender], amount);

    // Homomorphic addition: increase receiver's balance
    _balances[to] = FHE.add(_balances[to], amount);

    // Authorize both parties to view their own balances
    FHE.allowThis(_balances[msg.sender]);
    FHE.allow(_balances[msg.sender], msg.sender);
    FHE.allowThis(_balances[to]);
    FHE.allow(_balances[to], to);

    // At this point, Executor contract broadcasts event, notifying Coprocessor to execute actual FHE operations
}
```

### 3. Coprocessor Async Computation (Off-Chain)

After Coprocessor listens to the event, it executes the actual FHE addition/subtraction off-chain and submits the new ciphertext result back to chain. **This process is transparent to developers**, you don't need to interact with Coprocessor directly.

### 4. User Checks Balance (Off-Chain Decryption)

```ts
// Read ciphertext handle on chain
const encryptedBalance = await contract.balanceOf(userAddress);

// Request decryption from Gateway (Gateway checks ACL, only msg.sender has permission)
const clearBalance = await fhevm.decrypt32(contractAddress, encryptedBalance);

console.log("Your balance:", clearBalance); // Plaintext balance, only you can see
```

---

## Key Design Principles

### Principle 1: Only Store Handles On-Chain

Ciphertexts themselves can be very large (several KB to tens of KB), unsuitable for on-chain storage. Only a 32-byte handle is stored on-chain, actual ciphertext managed by Coprocessor.

### Principle 2: ACL is the Permission Boundary

Any access to ciphertext (whether within contract or user decryption) requires ACL authorization. Forgetting `allowThis` is the most common bug, causing the next transaction to fail when accessing ciphertext.

### Principle 3: Decryption is Asynchronous

On-chain does not immediately return plaintext. After decryption request is sent, need to wait for Gateway to coordinate KMS nodes, then result returned via callback or off-chain query. This means:

- **Contract logic cannot depend on "immediate decryption"**
- Where results are needed (like frontend displaying balance), call decryption interface off-chain

### Principle 4: Global Public Key = Ciphertext Interoperability

All users' encrypted inputs are encrypted with the same global public key, enabling:

```solidity
// Different users' balance ciphertexts can be directly added, no need to decrypt intermediate values
_balances[to] = FHE.add(_balances[from], _balances[extra]);
```

This is the key foundation for fhEVM to implement composable DeFi logic.

---

## Comparison with Other Privacy Solutions

| Solution | On-Chain Computation | Data Privacy | Composability | Typical Examples |
|------|----------|----------|----------|----------|
| fhEVM (Coprocessor)| Off-chain FHE + On-chain verification | Fully encrypted | High (shared public key) | Zama, Fhenix |
| ZK Rollup | Off-chain execution + On-chain ZK proof | Limited | Medium | zkSync, StarkNet |
| TEE (Trusted Execution Environment)| Inside TEE | Hardware-dependent | Medium | Secret Network |
| MPC | Multi-party collaborative computation | High | Low (requires online interaction) | Various MPC solutions |

---

## Further Reading

- [Zama Confidential Blockchain Protocol Litepaper](https://docs.zama.org/protocol/zama-protocol-litepaper)
- [fhEVM Protocol Overview](https://docs.zama.org/protocol/protocol/overview)
- [Fhenix Technical Blog](https://www.fhenix.io/blog)
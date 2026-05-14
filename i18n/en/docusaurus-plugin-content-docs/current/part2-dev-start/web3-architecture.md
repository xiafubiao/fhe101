# Web3 + FHE Architecture Patterns

fhEVM (Fully Homomorphic Ethereum Virtual Machine) is an open-source project developed by Zama that enables smart contracts on Ethereum and EVM-compatible chains to process encrypted data, achieving privacy protection. Traditional FHE computation is very resource-intensive — running it directly on-chain would result in prohibitively high gas costs and severely slow down block production. Therefore, fhEVM adopts a "off-chain computation + on-chain verification" Coprocessor architecture: users encrypt their data with the global public key and send it to the chain along with a ZKPoK zero-knowledge proof. The Solidity contracts only store ciphertext handles rather than the actual ciphertexts. The Coprocessor listens for events off-chain, retrieves ciphertexts, and executes actual FHE operations (addition, subtraction, multiplication, comparison, etc.). The result ciphertext is then submitted back on-chain. fhEVM uses the [TFHE scheme](https://docs.zama.org/tfhe-rs/get-started/security-and-cryptography) as its underlying technology, which automatically triggers lightweight Bootstrapping after each gate operation to prevent noise accumulation. This means developers writing Solidity contracts don't need to manually manage noise — they only need to use encrypted types like euint32 and euint256. The decryption process uses MPC + threshold cryptography, coordinated by Gateway and KMS (key management nodes) through multiple nodes collaborating. No single node can decrypt data alone. fhEVM also has a built-in ACL (Access Control List) system to manage "who can decrypt which ciphertext," ensuring only authorized addresses can request decryption. Representative use cases include confidential ERC-20 tokens, sealed auctions, private voting, and on-chain machine learning inference.

---

## fhEVM's Coprocessor Architecture

![fhEVM Architecture](/img/FHE_arc.png)

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
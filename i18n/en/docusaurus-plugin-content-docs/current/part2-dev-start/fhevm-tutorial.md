# fhEVM Practice: From Plain Contract to Privacy Contract

> This tutorial uses a simple counter contract as an example to demonstrate how to transform a regular Solidity contract into an fhEVM privacy contract. After completion, you will understand: encrypted types, encrypted inputs, ACL permission control, and how to read encrypted state off-chain.

## Prerequisites

- Familiar with Solidity basics
- Node.js 18+ and npm installed
- Understanding of Hardhat (if not, see [Hardhat Quick Start](https://hardhat.org/getting-started/))

---

## Step 1: Initialize Project

```bash
mkdir fhe-counter && cd fhe-counter
npx hardhat init
# Select "Create a TypeScript project"

# Install fhEVM dependencies
npm install @zama-network/hardhat-fhevm fhevmjs
```

Add plugin in `hardhat.config.ts`:

```ts
import "@zama-network/hardhat-fhevm";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      fhevm: {
        // Local development mode, no real FHE operations needed
        mode: "mocked",
      },
    },
  },
};
```

---

## Step 2: Write a Plain Counter

First, write the unencrypted version to understand the basic logic:

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

Problem: `_count` is public, anyone can view it.

---

## Step 3: Transform to fhEVM Privacy Contract

```solidity
// contracts/FHECounter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@zama-network/fhevm-contracts/contracts/FHE.sol";
import { ZamaEthereumConfig } from "@zama-network/fhevm-contracts/contracts/config/ZamaEthereumConfig.sol";

contract FHECounter is ZamaEthereumConfig {
    // Originally uint32, now encrypted integer
    euint32 private _count;

    // Key change 1: Input changed from uint32 to externalEuint32
    // externalEuint32 is value encrypted by user off-chain with global public key
    function increment(
        externalEuint32 inputValue,
        bytes calldata inputProof   // ZK proof: user indeed knows this value
    ) external {
        // Key change 2: Convert external ciphertext to on-chain operable euint32
        euint32 evalue = FHE.fromExternal(inputValue, inputProof);

        // Addition operation: Direct computation on ciphertext, no decryption needed
        _count = FHE.add(_count, evalue);

        // Key change 3: Access control authorization
        // Allow contract itself to access _count in subsequent transactions
        FHE.allowThis(_count);
        // Allow caller to view result off-chain
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

    // Returns ciphertext handle, not plaintext
    // Only addresses authorized by ACL can decrypt off-chain
    function getCount() external view returns (euint32) {
        return _count;
    }
}
```

### Key Change Summary

| Plain Contract | fhEVM Contract | Description |
|----------|------------|------|
| `uint32 _count` | `euint32 _count` | State variable stored encrypted |
| `function f(uint32 v)` | `function f(externalEuint32 v, bytes calldata proof)` | Input must be encrypted value + ZK proof |
| `_count += value` | `_count = FHE.add(_count, evalue)` | Homomorphic operation instead of plaintext |
| No permission control | `FHE.allowThis / FHE.allow` | Explicitly declare who can decrypt |

---

## Step 4: Interact with Contract in Tests

```ts
// test/FHECounter.ts
import { ethers } from "hardhat";
import { createInstance } from "fhevmjs";

async function main() {
  const [deployer, user] = await ethers.getSigners();

  // Deploy contract
  const FHECounter = await ethers.getContractFactory("FHECounter");
  const counter = await FHECounter.deploy();

  // Create fhEVM instance (handles encryption/decryption)
  const fhevm = await createInstance();

  // Encrypt input value 5 off-chain
  const { handles, inputProof } = await fhevm.createEncryptedInput(
    await counter.getAddress(),
    user.address
  ).add32(5).encrypt();

  // Send encrypted transaction
  await counter.connect(user).increment(handles[0], inputProof);

  // Read encrypted counter value (returns ciphertext handle)
  const encryptedCount = await counter.getCount();

  // Decrypt off-chain (only authorized address can succeed)
  const clearCount = await fhevm.decrypt32(
    await counter.getAddress(),
    encryptedCount
  );

  console.log("Decrypted counter value:", clearCount); // Should be 5
}
```

---

## Step 5: Deploy to Testnet

```bash
# Configure environment variables
export PRIVATE_KEY="your_private_key"

# Deploy to Sepolia (Zama's testnet)
npx hardhat run scripts/deploy.ts --network sepolia
```

Add Sepolia network config to `hardhat.config.ts`:

```ts
networks: {
  sepolia: {
    url: "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY",
    accounts: [process.env.PRIVATE_KEY!],
  },
},
```

---

## Understanding ACL Permission Control

ACL (Access Control List) is the system in fhEVM that manages "who can decrypt what":

```solidity
// Permanent authorization: Contract itself can access this ciphertext in all subsequent transactions
FHE.allowThis(encryptedValue);

// Permanent authorization: Specific address can decrypt off-chain
FHE.allow(encryptedValue, someAddress);

// Temporary authorization: Only valid within current transaction
FHE.allowTransient(encryptedValue, someAddress);
```

> **warning** A common mistake: Forgetting to call `FHE.allowThis()`, causing the contract to fail accessing this ciphertext in the next transaction (permission check fails).

---

## Next Step: More Complex Scenarios

After mastering the counter, you can try:

- **Private voting**: Use `euint32` to count votes for each candidate, confidential during voting period
- **Sealed auction**: Use `FHE.lt()` to compare encrypted bids, determine highest bidder
- **Private ERC-20**: See [Zama ConfidentialERC20 Example](https://github.com/zama-ai/fhevm/tree/main/examples)

---

## References

- [Zama fhEVM Official Documentation](https://docs.zama.org/protocol/solidity-guides)
- [fhEVM GitHub examples](https://github.com/zama-ai/fhevm/tree/main/examples)
- [fhEVM Quick Start Tutorial](https://docs.zama.org/protocol/solidity-guides/getting-started/quick-start-tutorial/turn_it_into_fhevm)
- [Zama Video Tutorial](https://www.zama.org/post/video-tutorial-how-to-write-confidential-smart-contracts-using-zamas-fhevm)
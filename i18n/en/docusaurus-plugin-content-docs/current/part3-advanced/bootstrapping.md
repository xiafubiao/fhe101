# Deep Dive into Bootstrapping

> Bootstrapping is the key that transforms FHE from "limited computation" to "unlimited computation". Understanding it requires three layers: intuition → mathematical structure → engineering practice. This article starts from the most basic question and unfolds layer by layer.

---

## I. Starting from a Question

**Is multiplication in FHE two ciphertexts multiplied together?**

Yes. The form of homomorphic multiplication is:

```
Enc(3) × Enc(5) = Enc(15)
```

Both sides are ciphertexts, neither party is decrypted, and the result is still ciphertext. This is the core meaning of "homomorphic."

The problem is: **Every time you do ciphertext multiplication, the noise inside the ciphertext grows significantly.**

---

## II. Why Noise is a Problem

### Structure of LWE Ciphertext

FHE's security is based on the LWE (Learning With Errors) problem. An LWE ciphertext looks like this:

```
ct = (a, b),  b = a·s + m·Δ + e
```

Where:
- a: Random vector, public
- s: Private key, secret
- e: Intentionally injected small noise (this is the source of LWE's "error" and the source of security)
- q: Ciphertext modulus (a large integer)
- Δ = q/t: Plaintext scaling factor

**Decryption** is:

```
b - a·s = m·Δ + e  → Rounding  →  m
```

As long as e is small enough, rounding correctly recovers m. Once e exceeds the threshold, decryption fails.

### Multiplication Makes Noise Explode

When multiplying two ciphertexts, the noise term expands approximately to:

```
e_new ≈ m1·e2 + m2·e1 + e1·e2
```

Addition just stacks, multiplication amplifies. Assuming the noise ceiling is 1000, each multiplication increases noise 10x:

```
Initial:         e = 1
1st multiplication:  e = 10
2nd multiplication:  e = 100
3rd multiplication:  e = 1000  ← At limit, another multiplication overflows, decryption fails
```

Without Bootstrapping, you can only do a fixed number of multiplications. This is called **Somewhat Homomorphic Encryption (SHE)**, "somewhat homomorphic," not "fully homomorphic."

---

## III. Intuition Behind Bootstrapping

**Think of noise as ink stains on scratch paper.**

Each multiplication adds some stains. When stains accumulate enough, the paper is too dirty to read the answer — meaning decryption fails.

The idea of Bootstrapping is: **Before the paper gets too dirty to read, copy the content to a new sheet.**

- The stains on the old paper don't transfer to the new paper
- The content written (the encrypted data) is exactly the same
- The new paper is clean and can continue to be written on

So after adding Bootstrapping:

```
1st multiplication:  e = 10
2nd multiplication:  e = 100
3rd multiplication:  e = 1000  ← About to overflow

↓ Bootstrapping (copy to new paper)

e reset to 1, content m unchanged

4th multiplication:  e = 10
5th multiplication:  e = 100
6th multiplication:  e = 1000  ← About to overflow again

↓ Bootstrapping

e reset to 1, continue...

Infinite loop → Supports arbitrary depth multiplication circuits
```

This is the meaning of "Fully" in **Fully** Homomorphic: unlimited computations.

---

## Four. Mathematical Implementation of Bootstrapping

### Core Observation

The decryption function itself is just a function of ciphertext (a, b) and private key s:

```
Dec(s, ct) = floor( (t/q) · (b - a·s) ) mod t
```

Gentry's key insight: **If I can execute this decryption function homomorphically, with input being the encrypted private key, I can output a brand new ciphertext with fresh noise, and no one sees the plaintext.**

### Specific Steps

**Step 1: Prepare Bootstrapping Key (bk)**

Re-encrypt each bit of the private key s with a new private key s':

```
bk = { Enc_{s'}(s_0), Enc_{s'}(s_1), ..., Enc_{s'}(s_{n-1}) }
```

This is a one-time initialization operation. bk is **permanently stored and repeatedly used, never consumed**.

**Step 2: Treat Old Ciphertext as "Constant"**

The old ciphertext ct_old = (a, b) with high noise is no longer a "ciphertext" in Bootstrapping, but a **public constant input** — like an ordinary number passed in.

**Step 3: Homomorphically Execute Decryption Circuit**

Using the encrypted private key in bk, homomorphically compute b - a·s, then round.

Throughout, s remains encrypted, no one sees the private key plaintext.

**Step 4: Output Fresh Ciphertext**

```
ct_new = Enc_{s'}(m),  e_new << e_old
```

### Where Does the Old Noise Go?

This is the most critical question.

The large noise e_old in ct_old is **digested by the rounding operation** during homomorphic decryption:

```
floor( (t/q) · (m·floor(q/t) + e_old) ) = m
```

e_old is rounded away as error, **not passed to the output ciphertext**.

The noise of output ciphertext ct_new comes from:
- Initial noise of ciphertexts in bk (fresh, small)
- Noise accumulated during homomorphic operations executing decryption circuit

Completely unrelated to e_old.

### Two Ciphertexts, Two Noise Sources

The key to understanding Bootstrapping is distinguishing two roles:

```
ct_old  : Ciphertext with near-full noise, encrypts m with private key s
         ↓ Identity demoted to "constant input"

bk      : s encrypted with new private key s', small noise
         ↓ Acts as "variable" in homomorphic computation

ct_new  : Output, encrypts m with s', noise comes from bk's fresh noise
         Has no relationship with the large noise in ct_old
```

### Why Can ct_new Continue Multiplication?

ct_new is just an ordinary fresh ciphertext. Its mathematical structure is exactly the same as when first encrypted, just using private key s' instead of s. Multiplication depth budget is fully restored, can continue the next round of computation.

---

## V. Complete Computation Flow

```
Initialization (one-time):
  Generate private key s'
  Compute bk = { Enc_{s'}(s_i) }   ← Fixed, permanent use

────────────────────────────────────────

Computation Phase (can loop infinitely):

  Enc(a) × Enc(b) = Enc(a·b)           e = 10
  Enc(a·b) × Enc(c) = Enc(a·b·c)       e = 100
  Enc(a·b·c) × Enc(d) = Enc(a·b·c·d)   e = 500  ← Leave margin, trigger Bootstrapping

  ↓ Bootstrapping (read bk, bk unchanged)

  Enc(a·b·c·d)   Content unchanged, e reset to 1

  Enc(a·b·c·d) × Enc(e_val) = Enc(a·b·c·d·e_val)   e = 10
  ...

  ↓ Bootstrapping (still use the same bk)

  Repeat infinitely
```

Note on timing: **Cannot wait until e actually overflows to Bootstrap**, because Bootstrapping itself also accumulates some noise. Need to trigger with margin still available.

---

## VI. Circular Security Assumption

There is a cryptographic subtlety here.

You encrypted s with s'. If s' = s (encrypting private key with itself), this is called **Key-Dependent Message (KDM) security**, also known as **Circular Security**.

Standard LWE security proofs don't cover this case. Bootstrapping requires an additional assumption: the scheme is secure even when encrypting the private key itself.

This assumption is currently widely accepted (no known attacks), but it is an additional cryptographic assumption for Bootstrapping, not "free."

---

## VII. TFHE's Gate Bootstrapping

TFHE takes Bootstrapping to the extreme: **Automatically triggers a lightweight Bootstrapping after each gate operation**, noise never accumulates. The cost is each gate pays fixed time (~10ms/CPU).

### Blind Rotation

The core operation of TFHE Bootstrapping is called **Blind Rotation**.

In the polynomial ring Z_q[X]/(X^N+1), define a **test vector** T(X), arranging coefficients into a lookup table of the function you want to evaluate:

```
T(X) = t_0 + t_1·X + t_2·X^2 + ... + t_{N-1}·X^{N-1}
```

The core operation is homomorphically computing:

```
T(X) · X^{b - Σ a_i·s_i}
```

After rotation, extracting a certain coefficient gives the function's value at v = b - Σ a_i·s_i — and it's a fresh encryption with small noise.

Since all s_i are encrypted (in bk), the entire rotation process is implemented via **CMux operations**, and no one sees s_i plaintext throughout.

### Programmable Bootstrapping (PBS)

TFHE's most powerful feature: **While refreshing noise (Bootstrapping's main job), homomorphically compute arbitrary lookup tables**.

One PBS can simultaneously do:
  - Noise reset (Bootstrapping's main job)
  - Compute ReLU (ML activation function)
  - Compute comparison operations (less than, greater than, equal)
  - Compute arbitrary piecewise functions

This is the core reason fhEVM chose TFHE: The large number of conditional branches and comparisons in smart contracts can all be completed in one PBS.

---

## VIII. Bootstrapping Comparison Across Schemes

| Scheme | Bootstrapping Method | Single Time (CPU) | Features |
|--------|-------------------|--------------|------|
| TFHE | Auto per gate (Gate BS) | ~10ms | Supports arbitrary functions (PBS) |
| CKKS | Manual trigger, batch | ~seconds (amortized to ms) | Approximate computation, efficient for ML |
| BGV/BFV | Still being optimized | Slower than CKKS | Exact integers, expensive for deep circuits |

GPU acceleration can reduce TFHE single Bootstrapping to ~0.1ms.

---

## IX. Practical Impact for Developers

**If you're writing Solidity contracts with fhEVM:**

No need to manually manage noise and Bootstrapping. TFHE auto-bootstraps each gate, fhEVM's Coprocessor handles all details off-chain, completely transparent to contract developers.

**If you're using TFHE-rs / OpenFHE directly:**

- TFHE-rs: PBS auto-triggers, no need to worry about noise
- OpenFHE (BFV/BGV): Need to manually set multiplicative depth parameters, ensure planned circuit doesn't exceed noise budget
- OpenFHE (CKKS): Has explicit Bootstrapping API, need to manually call at appropriate depth

**FHE Compilers (like Google HEIR):**

Automatically analyze your program and insert Bootstrapping calls at appropriate positions, no manual judgment needed.

---

## X. Further Reading

- [FHE Beginner's Textbook (arxiv 2503.05136)](https://arxiv.org/pdf/2503.05136)
- [Bootstrapping in FHE (Duality Tech)](https://dualitytech.com/blog/bootstrapping-in-fully-homomorphic-encryption-fhe/)
- [A High-Level Technical Overview of FHE (Jeremy Kun)](https://www.jeremykun.com/2024/05/04/fhe-overview/)
- [TFHE-rs Documentation](https://docs.zama.org/tfhe-rs)
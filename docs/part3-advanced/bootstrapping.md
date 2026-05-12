# Bootstrapping 深度讲解

> Bootstrapping 是 FHE 从"有限计算"变成"无限计算"的关键。理解它需要分三层：直觉 → 数学结构 → 工程实践。本文从最基础的问题出发，逐层展开。

---

## 一、从一个问题出发

**FHE 里的乘法，是两个密文相乘吗？**

是的。同态乘法的形式是：

```
Enc(3) × Enc(5) = Enc(15)
```

两边都是密文，没有任何一方被解密，结果仍然是密文。这是"同态"的核心含义。

问题在于：**每做一次密文乘法，密文里的噪声就会大幅增长。**

---

## 二、噪声为什么是问题

### LWE 密文的结构

FHE 的安全性建立在 LWE（Learning With Errors）问题上。一个 LWE 密文长这样：

```
ct = (a, b),  b = a·s + m·Δ + e
```

其中：
- a：随机向量，公开
- s：私钥，保密
- e：故意注入的小噪声（这是 LWE"错误"的来源，也是安全性的来源）
- q：密文模数（一个大整数）
- Δ = q/t：明文缩放因子

**解密**就是：

```
b - a·s = m·Δ + e  → 取整  →  m
```

只要 e 足够小，取整能正确恢复 m。一旦 e 超过阈值，解密就会出错。

### 乘法让噪声爆炸

两个密文相乘时，噪声项展开大约是：

```
e_new ≈ m1·e2 + m2·e1 + e1·e2
```

加法只是叠加，乘法是放大。假设噪声上限是 1000，每次乘法让噪声翻 10 倍：

```
初始：         e = 1
第 1 次乘法：  e = 10
第 2 次乘法：  e = 100
第 3 次乘法：  e = 1000  ← 到上限，再乘就溢出，解密出错
```

没有 Bootstrapping，你只能做固定次数的乘法。这叫 **Somewhat Homomorphic Encryption（SHE）**，"有点同态"，不是"完全同态"。

---

## 三、Bootstrapping 的直觉

**把噪声想象成草稿纸上的墨水污迹。**

每做一次乘法，污迹就增加一些。污迹积累到一定程度，纸面太脏，答案看不清——也就是解密出错。

Bootstrapping 的想法是：**在纸快脏到看不清之前，把内容抄到一张新纸上。**

- 旧纸上的污迹没有转移到新纸上
- 新纸上写的内容（加密的数据）完全一样
- 新纸是干净的，可以继续写

所以加入 Bootstrapping 之后：

```
第 1 次乘法：  e = 10
第 2 次乘法：  e = 100
第 3 次乘法：  e = 1000  ← 快溢出

↓ Bootstrapping（抄到新纸）

e 重置为 1，内容 m 不变

第 4 次乘法：  e = 10
第 5 次乘法：  e = 100
第 6 次乘法：  e = 1000  ← 又快溢出

↓ Bootstrapping

e 重置为 1，继续...

无限循环 → 支持任意深度的乘法电路
```

这就是 **Fully** Homomorphic 里"Fully"的含义：无限次计算。

---

## 四、Bootstrapping 的数学实现

### 核心观察

解密函数本身只是一个关于密文 (a, b) 和私钥 s 的函数：

```
Dec(s, ct) = floor( (t/q) · (b - a·s) ) mod t
```

Gentry 的关键洞察：**如果我能同态地执行这个解密函数，输入是加密的私钥，就能输出一个噪声全新的密文，同时没有人看到明文。**

### 具体步骤

**第一步：准备 Bootstrapping Key（bk）**

把私钥 s 的每一位，用一把新的私钥 s' 重新加密：

```
bk = { Enc_{s'}(s_0), Enc_{s'}(s_1), ..., Enc_{s'}(s_{n-1}) }
```

这是一次性的初始化操作，bk 之后**永久保存，反复使用，不会被消耗**。

**第二步：把旧密文当"常数"**

原来噪声快满的 ct_old = (a, b)，在 Bootstrapping 里不再是"密文"，而是**公开的常数输入**——就像普通的数字一样传进去。

**第三步：同态执行解密电路**

用 bk 里的加密私钥，同态地计算 b - a·s，再取整。

全程 s 都处于加密状态，没有人看到私钥明文。

**第四步：输出新鲜密文**

```
ct_new = Enc_{s'}(m),  e_new << e_old
```

### 旧噪声去哪了？

这是最关键的问题。

ct_old 里的大噪声 e_old，在同态解密时，被取整操作**消化掉了**：

```
floor( (t/q) · (m·floor(q/t) + e_old) ) = m
```

e_old 被当作误差舍入掉，**不传递到输出密文里**。

输出密文 ct_new 的噪声，来自：
- bk 里各密文的初始噪声（新鲜的，很小）
- 执行解密电路时同态运算累积的噪声

跟 e_old 完全无关。

### 两个密文，两套噪声

理解 Bootstrapping 的关键是区分两个角色：

```
ct_old  ：噪声快满的密文，用私钥 s 加密 m
           ↓ 身份降级为"常数输入"

bk      ：用新私钥 s' 加密的 s，噪声很小
           ↓ 作为"变量"参与同态计算

ct_new  ：输出，用 s' 加密 m，噪声来自 bk 的新鲜噪声
           跟 ct_old 里的大噪声没有任何关系
```

### 为什么 ct_new 可以继续做乘法？

ct_new 就是一个普通的新鲜密文，数学结构和刚加密时完全一样，只不过用的是私钥 s' 而不是 s。乘法深度预算完全恢复，可以继续做下一轮计算。

---

## 五、完整计算流程

```
初始化（一次性）：
  生成私钥 s'
  计算 bk = { Enc_{s'}(s_i) }   ← 固定，永久使用

─────────────────────────────────────────

计算阶段（可无限循环）：

  Enc(a) × Enc(b) = Enc(a·b)           e = 10
  Enc(a·b) × Enc(c) = Enc(a·b·c)       e = 100
  Enc(a·b·c) × Enc(d) = Enc(a·b·c·d)   e = 500  ← 留余量，触发 Bootstrapping

  ↓ Bootstrapping（读取 bk，bk 不变）

  Enc(a·b·c·d)   内容不变，e 重置为 1

  Enc(a·b·c·d) × Enc(e_val) = Enc(a·b·c·d·e_val)   e = 10
  ...

  ↓ Bootstrapping（还是用同一个 bk）

  无限重复
```

注意触发时机：**不能等到 e 真的溢出才 Bootstrap**，因为 Bootstrapping 本身也会累积一定噪声，需要提前在还有余量的时候触发。

---

## 六、循环安全假设

这里有一个密码学上的微妙问题。

你用 s' 加密了 s，如果 s' = s（私钥加密自己），这叫 **Key-Dependent Message（KDM）安全性**，也叫**循环安全（Circular Security）**。

标准 LWE 的安全性证明不覆盖这种情况。Bootstrapping 需要额外假设：即使加密的是私钥本身，方案也是安全的。

目前这个假设被广泛接受（没有已知攻击），但它是 Bootstrapping 的一个额外密码学假设，不是"免费"的。

---

## 七、TFHE 的 Gate Bootstrapping

TFHE 把 Bootstrapping 做到了极致：**每个门操作后自动触发一次轻量 Bootstrapping**，噪声永远不会积累。代价是每个门都要付出固定时间（~10ms/CPU）。

### 盲旋转（Blind Rotation）

TFHE Bootstrapping 的核心操作，叫**盲旋转**。

在多项式环 Z_q[X]/(X^N+1) 里，定义一个**测试向量** T(X)，把系数排列成你想求值的函数的查找表：

```
T(X) = t_0 + t_1·X + t_2·X^2 + ... + t_{N-1}·X^{N-1}
```

核心操作是同态地计算：

```
T(X) · X^{b - Σ a_i·s_i}
```

旋转之后，提取某个系数，就得到了函数在 v = b - Σ a_i·s_i 处的值——而且是全新的加密，噪声很小。

由于 s_i 都是加密的（存在 bk 里），整个旋转过程通过 **CMux 操作**实现，全程没有人看到 s_i 的明文。

### 可编程 Bootstrapping（PBS）

TFHE 最强大的特性：可以**在刷新噪声的同时，同态地计算任意查找表**。

```
一次 PBS 可以同时做：
  ✓ 噪声重置（Bootstrapping 本职工作）
  ✓ 计算 ReLU（机器学习激活函数）
  ✓ 计算比较运算（<, >, ==）
  ✓ 计算任意分段函数
```

这是 fhEVM 选择 TFHE 的核心原因：智能合约里大量的条件分支和比较，都可以在一次 PBS 里完成。

---

## 八、各 Scheme 的 Bootstrapping 对比

| Scheme | Bootstrapping 方式 | 单次时间（CPU）| 特点 |
|--------|-------------------|--------------|------|
| TFHE | 每个门自动触发（Gate BS）| ~10ms | 支持任意函数（PBS）|
| CKKS | 手动触发，批量处理 | ~秒级（摊薄后 ms 级）| 近似计算，ML 场景高效 |
| BGV/BFV | 仍在优化中 | 比 CKKS 慢 | 精确整数，深层电路代价高 |

GPU 加速可以把 TFHE 单次 Bootstrapping 压到 ~0.1ms。

---

## 九、对开发者的实际影响

**如果你用 fhEVM 写 Solidity 合约：**

不需要手动管理噪声和 Bootstrapping。TFHE 每个门自动 Bootstrap，fhEVM 的 Coprocessor 在链下处理所有细节，对合约开发者完全透明。

**如果你用 TFHE-rs / OpenFHE 直接开发：**

- TFHE-rs：PBS 自动触发，无需关心噪声
- OpenFHE（BFV/BGV）：需要手动设置乘法深度参数，确保计划的电路不超出噪声预算
- OpenFHE（CKKS）：有显式的 Bootstrapping API，需要在合适的深度手动调用

**FHE 编译器（如 Google HEIR）：**

会自动分析你的程序，在合适的位置插入 Bootstrapping 调用，不需要开发者手动判断。

---

## 十、延伸阅读

- [FHE Beginner's Textbook（arxiv 2503.05136）](https://arxiv.org/pdf/2503.05136)
- [Bootstrapping in FHE（Duality Tech）](https://dualitytech.com/blog/bootstrapping-in-fully-homomorphic-encryption-fhe/)
- [A High-Level Technical Overview of FHE（Jeremy Kun）](https://www.jeremykun.com/2024/05/04/fhe-overview/)
- [TFHE-rs 文档](https://docs.zama.org/tfhe-rs)
# SpendBoundary — Operating Rules & Financial Security Constraints

This document defines the strict security invariants, financial boundaries, and architectural rules governing SpendBoundary.

---

## 1. Core Priority Hierarchy

1. **Payment & Fund Safety:** Never allow an unconstrained AI or unvalidated cart to debit money.
2. **Deterministic Policy Gate:** Server-side evaluation must be pure, testable, and free of non-deterministic LLM hallucination.
3. **Frictionless Autonomous Commerce:** Autonomous sub-limit purchases (< ₹1,000) must execute without OTP or context-breaking popup tabs once a card mandate is authorized.
4. **Transparent Human Review:** Above-limit purchases (> ₹1,000) must halt the AI and deliver a hosted Razorpay payment link for human authorization.
5. **Cryptographic Proof & Immutability:** Every policy decision and payment attempt must be hashed into the SHA-256 Merkle audit chain.

---

## 2. Invariant Technology & Protocol Choices

- **Language & Framework:** TypeScript with Next.js 15 (App Router).
- **Styling & Icons:** Tailwind CSS with Lucide React icons.
- **Database:** SQLite with Prisma ORM 5.22.
- **AI Agent Protocol:** Anthropic Model Context Protocol (MCP) JSON-RPC 2.0.
- **Payment Provider:** Razorpay Test Mode API (`/v1/orders`, `/v1/payment_links`, `/v1/payments`) with offline mock fallback.
- **Ledger Security:** Cryptographic SHA-256 Merkle hash chain (`crypto.createHash("sha256")`).
- **Testing:** Pure function unit tests with Vitest.

---

## 3. Strict Prohibitions

- **NO Live Production Charges:** Never execute real financial charges or accept live credit cards during testing/demos.
- **NO Plaintext Credential Storage:** Never expose or store raw card numbers, CVVs, or gateway secret keys.
- **NO Client-Side Price Calculations:** Never trust cart totals, item prices, or discounts submitted by AI agents or client frontends.
- **NO Direct Database/Payment Writes by AI:** The LLM cannot directly modify database tables, alter policy limits, or call payment APIs.
- **NO Floating-Point Money Arithmetic:** Never use floating-point numbers for currency; all financial amounts must be integer paise ($1\text{ INR} = 100\text{ Paise}$).

---

## 4. AI Agent Boundaries (The Untrusted Proposer)

The AI Agent (Claude / ChatGPT) is strictly an **untrusted proposer**:

### Allowed Actions:
- Search product catalogue through `search_catalogue`.
- Inspect product details through `get_product`.
- Query current policy boundaries via `get_policy_limits`.
- Query card mandate status via `get_payment_mandate_status`.
- Request cart checkout via `request_checkout`.
- Reconcile approval/payment status via `check_approval_status`.
- Cancel or delete pending requests via `cancel_request`.

### Strictly Forbidden Actions:
- Approving its own payment request.
- Overriding or modifying policy thresholds.
- Calculating or supplying the final payable total.
- Calling Razorpay or bank APIs directly.
- Reading server environment secrets (`RAZORPAY_KEY_SECRET`, etc.).
- Marking an order status as `PAID` without server verification.
- Asking users in chat for raw card numbers, CVVs, or OTPs.

---

## 5. Policy Engine Execution Rules

The policy engine (`lib/policy-engine.ts`) must execute as a **pure deterministic function**:

$$\text{evaluatePolicy}(\text{PolicyInput}) \longrightarrow \text{PolicyDecisionResult}$$

### Decision Rules:
1. **`DENY`:** If any hard constraint is breached (Order amount $>$ Max Order Cap, Daily spend $>$ Daily Limit, Blocked Category, or Velocity burst $>$ limit). Zero payment calls are created.
2. **`REVIEW`:** If the order amount exceeds the Human Approval Threshold (e.g. $>$ ₹1,000). The agent is halted and a hosted Razorpay payment link is issued.
3. **`ALLOW`:** If all policy rules pass ($<$ ₹1,000). The server executes an autonomous debit via the pre-authorized card mandate.

### Required Output Fields for Every Evaluation:
- `decision`: `"ALLOW"` | `"REVIEW"` | `"DENY"`
- `reasons`: Array of structured reason objects `[{ ruleId, message, requestedPaise, limitPaise }]`
- `policyVersion`: Version string (e.g. `"v1.0"`)
- `requestId`: Unique request identifier (`req_...`)

---

## 6. Payment & Mandate Engine Rules

1. **Card Pre-Authorization Setup:** If no card is on file, the system must generate a ₹1 live Razorpay setup link.
2. **Active Real-Time Reconciliation:** The system must actively query Razorpay's API (`/v1/payment_links` and `/v1/payments`) to confirm ₹1 capture and extract card details without relying solely on public webhook tunnels.
3. **Zero-OTP Sub-Limit Debits:** Once verified, all purchases under ₹1,000 must execute autonomously in chat without OTP prompts or opening external browser tabs.
4. **Idempotency Guarantee:** Every transaction is assigned a unique `idempotencyKey`. Network retries or repeated webhook triggers must reuse the existing record without double-debiting.
5. **Webhook Security:** Razorpay webhook payloads must be verified using HMAC-SHA256 signatures with constant-time comparison (`crypto.timingSafeEqual`).

---

## 7. Cryptographic Audit Ledger Rules

1. **Append-Only Immutability:** Audit records are strictly append-only. No `UPDATE` or `DELETE` operations are permitted.
2. **Cryptographic Linkage:** Every block hash is computed over the entire previous state:
   $$\text{eventHash} = \text{SHA256}(\text{previousHash} + \text{canonicalPayloadJson} + \text{eventType} + \text{createdAt})$$
3. **Universal Event Logging:** Every state transition (`POLICY_DECISION_EVALUATED`, `PAYMENT_ATTEMPT_RECORDED`, `PAYMENT_MANDATE_ACTIVATED`, `MANDATE_AUTO_DEBIT_CAPTURED`, `PURCHASE_BLOCKED_BY_POLICY`, `PURCHASE_CANCELLED`) must be recorded.
4. **Tamper Verification:** The system must provide a verification function that recalculates the entire hash chain from the genesis block and reports any altered records or broken links.

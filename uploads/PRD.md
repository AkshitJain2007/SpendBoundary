# SpendBoundary — Product Requirements Document

**Project Type:** FinTech + AI/ML + DevTools & Infra  
**Target:** Policy Gateway and Execution Firewall for Autonomous AI Buyer Agents  
**Status:** Feature Complete — Review Ready  
**Payment Mode:** Live Razorpay Test Mode API + Tokenized Card Mandates + Fallback Mock Gateway  

---

## 1. Product Summary

SpendBoundary is a merchant-side trust layer and financial firewall for AI buyers. An AI agent (e.g., Claude Desktop, ChatGPT Custom GPTs) can search a product catalogue, build carts, and request purchases, but it **never** gets direct access to raw credit cards, bank credentials, or unconstrained payment APIs.

Every checkout request passes through a deterministic server-side policy gate:
- **ALLOW (< ₹1,000):** Executes autonomously without human OTP via a tokenized pre-authorized card mandate.
- **REVIEW (> ₹1,000):** Halts the agent and issues a live Hosted Razorpay Payment Link for human authorization.
- **DENY:** Blocks policy violations (overspend, unallowed categories, velocity bursts) with zero payment calls.

Every agent action, policy evaluation, human decision, and payment event is cryptographically sealed in an append-only SHA-256 Merkle audit trail.

---

## 2. Problem Statement

Autonomous AI agents are capable of researching, negotiating, and shopping on behalf of users and companies. However:
1. **The Direct Access Hazard:** Giving an AI an API key or credit card means a single hallucination, rogue loop, or prompt injection can drain an account.
2. **The High-Friction Dilemma:** Requiring 2FA / OTP confirmation for every routine ₹50 office supply or API credit purchase destroys the autonomous agent workflow.
3. **The Audit Gap:** Traditional payment gateways cannot explain *why* an AI made a transaction, *which* prompt triggered it, or *whether* retries created duplicate debits.

---

## 3. Implemented Core Features

### F1. Merchant Product Catalogue
- Inventory of 6 diverse SKUs (Executive Notebook ₹350, Gel Pen Set ₹150, 100W USB-C Cable ₹499, LED Desk Lamp ₹1,500, Ergonomic Chair ₹8,000, USB Crypto Mining Key ₹5,000).
- Server-enforced pricing in integer paise (1 Rupee = 100 Paise).
- Category tagging and merchant allow/block status.

### F2. Dynamic Policy Configuration Engine
Merchant-defined spending boundaries with live database updates:
- **Max Single-Order Value:** ₹2,000 default.
- **Daily Spend Limit:** ₹5,000 cumulative 24h cap.
- **Velocity Limit:** Max 3 requests per 60-second window.
- **Allowed Categories:** Whitelist of approved merchant categories.
- **Human Approval Threshold:** Orders above ₹1,000 require manual review.

### F3. Model Context Protocol (MCP) Standard Server
Standardized JSON-RPC 2.0 interface supporting Claude Desktop & ChatGPT Custom GPTs:
- `search_catalogue`: Search inventory by text or category.
- `get_product`: Fetch verified product metadata and price.
- `get_policy_limits`: Fetch policy limits and card mandate status.
- `get_payment_mandate_status`: Query pre-authorized card status or generate setup link.
- `setup_payment_mandate`: Generate a ₹1 Razorpay authorization link.
- `revoke_payment_mandate`: Revoke stored card mandate.
- `request_checkout`: Evaluate cart and execute autonomous debit or review link.
- `check_approval_status`: Reconcile payment status with Razorpay API.
- `cancel_request`: Cancel or delete a pending checkout request.
- `reset_demo_state`: 1-click reset of daily spent totals and test records.

### F4. Tokenized Card Mandate Pre-Authorization
- **₹1 Setup Verification Link:** When an AI first interacts with SpendBoundary, if no card is stored, it immediately provides a live ₹1 Razorpay link.
- **Real-Time API Reconciliation:** SpendBoundary polls Razorpay's API (`/v1/payment_links` and `/v1/payments`) to instantly detect ₹1 payment capture and extract card network/last4 (e.g. `RuPay •••• 1005`).
- **Autonomous Zero-OTP Debits:** Once verified, all purchases under ₹1,000 execute automatically in chat without OTP or popup tabs, keeping the conversation uninterrupted.

### F5. Human Review & Razorpay Payment Link Gateway
- Purchases exceeding the threshold (> ₹1,000) are placed in a `REVIEW` state.
- Automatically generates a Hosted Razorpay Payment Link (`https://rzp.io/rzp/...`).
- Real-time approvals dashboard allows merchants to inspect reason, policy triggers, and override/approve.
- Automatic 10-minute expiry on pending reviews.

### F6. Safe Idempotency & Duplicate Protection
- Every request is tagged with a unique internal `idempotencyKey` and `requestId`.
- Network retries or duplicate webhook payloads reuse the existing payment record without double-charging.
- Cryptographic HMAC-SHA256 signature verification on Razorpay webhook events.

### F7. Tamper-Evident SHA-256 Merkle Audit Ledger
- Append-only blockchain-style hash chain storing every state change.
- Each event hash links to `previousHash`, canonical payload JSON, and timestamp.
- Interactive **"Simulate Tamper"** tool injects a simulated database edit to prove instant cryptographic detection.

---

## 4. 10-Scenario Demo Validation Matrix

| # | Scenario | Input / Action | Expected Result | Status |
|---|---|---|---|:---:|
| 1 | **Card Mandate Setup** | Agent checks mandate with no card stored | Returns `NO_CARD_STORED` and generates live ₹1 Razorpay link | ✅ PASS |
| 2 | **Live Reconciliation** | User pays ₹1 on Razorpay link | API polling detects payment, activates mandate (`RuPay •••• 1005`) | ✅ PASS |
| 3 | **Autonomous Sub-Limit** | Buy ₹350 Executive Notebook | `ALLOW` — Auto-debited from saved card with Zero OTP in chat | ✅ PASS |
| 4 | **Single-Order Overspend** | Buy ₹8,000 Ergonomic Chair | `DENY` — Exceeds ₹2,000 max order cap; zero payment calls | ✅ PASS |
| 5 | **Blocked Category** | Buy ₹5,000 Crypto Mining Key | `DENY` — Category not whitelisted; request rejected | ✅ PASS |
| 6 | **Velocity Rate Limiting** | Submit 4 checkouts in 10 seconds | `DENY` — Velocity limiter triggers on 4th request | ✅ PASS |
| 7 | **Daily Limit Exhaustion** | Orders cumulatively reach ₹5,000 | `DENY` — Daily spend cap reached; subsequent orders blocked | ✅ PASS |
| 8 | **Human Approval Review** | Buy ₹1,500 LED Desk Lamp | `REVIEW` — Halts AI, creates ₹1,500 Razorpay link for user | ✅ PASS |
| 9 | **Idempotent Retry** | Re-send same checkout with duplicate key | Returns existing payment record without creating second charge | ✅ PASS |
| 10 | **Tamper Detection** | Mutate past audit payload in SQLite | Ledger verification fails with red warning & broken block index | ✅ PASS |

---

## 5. Non-Functional Requirements & Security

- **Integer Arithmetic:** Zero floating-point arithmetic. All monetary values are strictly handled in integer paise to eliminate rounding exploits.
- **Server-Side Price Authority:** Cart totals are re-fetched and calculated from the database, ignoring client/agent-supplied prices.
- **Protocol Compliance:** Fully compliant with Anthropic Model Context Protocol (MCP) JSON-RPC 2.0 specifications.
- **Zero Raw Credential Exposure:** AI agents and clients never receive API secrets, card CVVs, or gateway private keys.

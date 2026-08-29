# SpendBoundary — Architecture

## 1. Architecture Goal & Trust Boundaries

SpendBoundary acts as a merchant-side cryptographic policy gateway and execution firewall between autonomous AI buyer agents and real financial rails:

```text
AI Agent Proposes (via Model Context Protocol)
  ↓
Server Validates & Recomputes Cart Total (Server-side Integer Paise)
  ↓
Deterministic Policy Engine Evaluates (Max Order, Daily Cap, Category, Velocity)
  ├── ALLOW (< ₹1,000) ──> Tokenized Card Mandate (Zero-OTP Autonomous Debit)
  ├── REVIEW (> ₹1,000) ─> Human Approval + Hosted Razorpay Payment Link
  └── DENY (Violations) ─> Blocked at Gateway (Zero Payment Calls)
  ↓
Cryptographic SHA-256 Merkle Audit Ledger Appends Event & Updates Hash Chain
```

**Core Invariant:** The AI agent is an untrusted proposer. It can never directly hold payment credentials, alter product prices, modify policy limits, write directly to the database, or mark a transaction as paid.

---

## 2. Production Tech Stack

- **Framework & API:** Next.js 15 (App Router, Server Actions, Dynamic Route Handlers) with TypeScript.
- **UI & Design System:** React 19, Tailwind CSS, Lucide Icons, Glassmorphic Dark Navy Theme (`#0B1220`, `#111C2E`).
- **Database & ORM:** SQLite with Prisma ORM 5.22 (all financial amounts strictly stored in integer paise).
- **Policy Engine:** Pure, deterministic TypeScript functions with comprehensive Vitest unit test coverage.
- **AI Agent Protocol:** Model Context Protocol (MCP) Standard Server (`/api/mcp` HTTP POST & Stdio CLI `scripts/mcp-server.ts`). Compatible with Claude Desktop and ChatGPT Custom GPT Actions.
- **Payment Gateway:** 
  - Real Razorpay Test Mode API integration (`POST /v1/orders`, `POST /v1/payment_links`, `GET /v1/payments/{id}`).
  - Card-on-File Pre-Authorized Mandates via ₹1 Setup Link with real-time API reconciliation and HMAC-SHA256 webhook validation.
  - Deterministic fallback mock gateway for offline testing.
- **Audit & Security:** Append-only SHA-256 Merkle hash chain ledger with interactive tamper-injection and cryptographic validation.
- **Testing:** Vitest for policy engine unit tests, Next.js build validation.

---

## 3. High-Level Components

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SpendBoundary UI                               │
│  [Agent Console] [Policy Editor] [Catalogue] [Approvals] [Audit] [MCP Guide] │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
                       ▼                               ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│       Next.js API Layer      │              │     MCP Protocol Server      │
│ (/api/checkout, /api/policy) │              │  (Claude Desktop / ChatGPT)  │
└──────────────┬───────────────┘              └──────────────┬───────────────┘
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │  Server-Side Cart Recalculator│
                       │   (Integer Paise Enforcement)│
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │  Deterministic Policy Engine │
                       │    (ALLOW / REVIEW / DENY)   │
                       └──────────────┬───────────────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               ▼                      ▼                      ▼
        [ALLOW Path]           [REVIEW Path]           [DENY Path]
   Tokenized Card Mandate    Human Approval Queue    Immediate Rejection
   (Zero-OTP Auto-Debit)    (Razorpay Payment Link) (Zero Payment Calls)
               │                      │                      │
               └──────────────────────┼──────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │ Razorpay Gateway Integration │
                       │  (Orders, Links, Webhooks)   │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │   SHA-256 Audit Blockchain   │
                       │ (Tamper-Evident Hash Chain)  │
                       └──────────────────────────────┘
```

### 3.1 Web Application (Dashboard Tabs)
1. **Agent Console:** Interactive AI shopping simulator with live tool-calling telemetry, cart inspection, and decision streaming.
2. **Policy Editor:** Live merchant policy control (Order limit, daily spend cap, velocity window, allowed categories, human approval threshold).
3. **Product Catalogue:** 6 SKU inventory with live pricing, category tagging, and merchant allow/block toggles.
4. **Human Approvals Queue:** Real-time queue for orders exceeding spending limits with Razorpay Customer Payment Link badges and administrative override buttons.
5. **Cryptographic Audit Ledger:** Real-time SHA-256 event timeline, canonical payload inspector, and interactive "Simulate Tamper" verification tool.
6. **MCP Guide & Live Tester:** Ready-to-copy JSON configuration for Claude Desktop and interactive browser-based MCP tool caller.

### 3.2 Model Context Protocol (MCP) Server
Standardized JSON-RPC 2.0 tool provider exposed over HTTP (`/api/mcp`) and stdio (`scripts/mcp-server.ts`):
- `search_catalogue(query)`: Searches inventory by keywords or categories.
- `get_product(productId)`: Fetches verified SKU price and metadata.
- `get_policy_limits(agentId)`: Returns merchant spend boundaries and card mandate status.
- `get_payment_mandate_status(agentId)`: Checks pre-authorized card status or generates ₹1 setup link.
- `setup_payment_mandate(agentId, maxSingleDebitRupees)`: Generates a live ₹1 Razorpay authorization link.
- `revoke_payment_mandate(agentId)`: Revokes card mandate.
- `request_checkout(items, reason, agentId)`: Submits cart to policy gate for autonomous debit or review.
- `check_approval_status(requestId)`: Checks payment/review state with live Razorpay reconciliation.
- `cancel_request(requestId, reason)`: Cancels or deletes a pending checkout request.
- `reset_demo_state()`: Resets daily spent totals and test transactions to ₹0.00.

### 3.3 Deterministic Policy Engine (`lib/policy-engine.ts`)
A pure function with zero external side-effects:
```ts
evaluatePolicy(input: PolicyEvaluationInput): PolicyDecisionResult
```
Enforces:
- `MAX_ORDER_EXCEEDED`: Blocks carts above merchant single-order ceiling (₹2,000).
- `DAILY_LIMIT_EXCEEDED`: Blocks transactions exceeding cumulative 24h spend cap (₹5,000).
- `BLOCKED_CATEGORY` / `BLOCKED_PRODUCT`: Blocks unapproved items (e.g. Crypto Hardware Miners).
- `VELOCITY_LIMIT_EXCEEDED`: Blocks automated request bursts (e.g. >3 requests per 60s).
- `APPROVAL_THRESHOLD_TRIGGERED`: Routes medium/high-value purchases (> ₹1,000) to human review.

### 3.4 Razorpay Payment Adapter & Mandate Engine (`lib/payments/razorpay-gateway.ts`)
- **Card-on-File Pre-Authorization:** When no card is stored, generates a ₹1 live Razorpay payment link.
- **Active Real-Time API Reconciliation:** Direct API polling (`fetchPaymentLink` & `fetchPayment`) verifies payment capture and extracts card details (`RuPay •••• 1005`) without requiring public webhook tunnels.
- **Zero-OTP Autonomous Debits:** Sub-limit orders (< ₹1,000) execute via tokenized card mandate with order logging on the Razorpay Dashboard.
- **Hosted Payment Links:** Above-limit orders (> ₹1,000) generate hosted payment links (`https://rzp.io/rzp/...`) for human authorization.
- **HMAC-SHA256 Webhook Verification:** Validates webhook authenticity using `crypto.timingSafeEqual`.

### 3.5 Cryptographic Audit Service (`lib/audit.ts`)
- Implements an append-only Merkle-style hash chain in SQLite.
- Every event hash is calculated as:
  $$\text{eventHash} = \text{SHA256}(\text{previousHash} + \text{canonicalPayloadJson} + \text{eventType} + \text{createdAt})$$
- `verifyAuditChain()` traverses all records and verifies cryptographic integrity.
- Detects unauthorized database modifications or record tampering.

---

## 4. End-to-End Request Flows

### 4.1 Autonomous Sub-Limit Purchase (Zero-OTP Flow)
```text
User in ChatGPT: "Buy ₹350 notebook"
  ↓
MCP: request_checkout([{ productId: "prod_notebook", quantity: 1 }])
  ↓
Server recalculates total: 1 × ₹350 = ₹350.00 (35,000 paise)
  ↓
Policy Engine: ₹350 < ₹1,000 limit → ALLOW
  ↓
Mandate Engine: Active stored card found (RuPay •••• 1005)
  ↓
Razorpay Gateway: Creates Razorpay Order (order_...) & charges token
  ↓
Prisma DB: AgentRequest marked as PAID
  ↓
Audit Ledger: Appends PAYMENT_ATTEMPT_RECORDED & MANDATE_AUTO_DEBIT_CAPTURED
  ↓
AI Chat Response: "Done — Purchased ₹350 notebook. Automatically debited from your saved RuPay card (•••• 1005) without OTP."
```

### 4.2 Above-Limit Purchase (Human Review Flow)
```text
User in ChatGPT: "Buy ₹1,500 desk lamp"
  ↓
MCP: request_checkout([{ productId: "prod_desk_lamp", quantity: 1 }])
  ↓
Server recalculates total: ₹1,500.00 (150,000 paise)
  ↓
Policy Engine: ₹1,500 > ₹1,000 threshold → REVIEW
  ↓
Razorpay Gateway: Generates live Payment Link (https://rzp.io/rzp/...)
  ↓
Prisma DB: Approval created with 10-minute expiry
  ↓
AI Chat Response: "This purchase exceeds your ₹1,000 limit. Please authorize via Razorpay: https://rzp.io/rzp/..."
  ↓
User clicks link & pays on Razorpay → Webhook / API Reconciliation marks order PAID.
```

### 4.3 Policy Violation Flow (Denial)
```text
Agent requests: "Buy ₹5,000 Crypto Mining Key"
  ↓
Server recalculates total: ₹5,000.00
  ↓
Policy Engine: Category "Cryptocurrency Hardware" is not whitelisted → DENY
  ↓
Zero payment calls created.
  ↓
Audit Ledger: Appends PURCHASE_BLOCKED_BY_POLICY with exact rule violations.
  ↓
AI Chat Response: "Purchase denied by SpendBoundary: Category not allowed."
```

---

## 5. Database Schema (`prisma/schema.prisma`)

```prisma
model Product {
  id          String   @id
  name        String
  category    String
  pricePaise  Int
  stock       Int      @default(100)
  allowed     Boolean  @default(true)
  description String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Policy {
  id                     String   @id @default("policy_default")
  merchantId             String   @default("merchant_apex_01")
  maxOrderPaise          Int      @default(200000)
  dailyLimitPaise        Int      @default(500000)
  velocityCount          Int      @default(3)
  velocityWindowSeconds  Int      @default(60)
  allowedCategories      String   // JSON array
  approvalThresholdPaise Int      @default(100000)
  version                String   @default("v1")
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}

model AgentRequest {
  id                   String           @id // req_...
  agentId              String
  cartSnapshot         String           // JSON items
  requestedAmountPaise Int
  reason               String
  status               String           @default("PENDING") // PENDING, ALLOWED, REVIEW_REQUIRED, REJECTED, PAID
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt
  decision             PolicyDecision?
  approval             Approval?
  paymentAttempts      PaymentAttempt[]
}

model PolicyDecision {
  id            String       @id @default(cuid())
  requestId     String       @unique
  request       AgentRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  decision      String       // ALLOW, REVIEW, DENY
  reasons       String       // JSON reason objects
  policyVersion String
  evaluatedAt   DateTime     @default(now())
}

model Approval {
  id         String       @id @default(cuid())
  requestId  String       @unique
  request    AgentRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  reviewerId String?
  decision   String       @default("PENDING") // PENDING, APPROVED, REJECTED, EXPIRED
  comment    String?
  expiresAt  DateTime
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
}

model PaymentAttempt {
  id              String       @id @default(cuid())
  requestId       String
  request         AgentRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  provider        String       // RAZORPAY_TEST, RAZORPAY_CARD_MANDATE
  providerOrderId String?
  idempotencyKey  String       @unique
  status          String       @default("CREATED") // CREATED, AUTHORIZED, CAPTURED, FAILED
  amountPaise     Int
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

model PaymentMandate {
  id              String   @id @default(cuid())
  agentId         String   @unique
  customerEmail   String   @default("user@spendboundary.ai")
  status          String   @default("ACTIVE") // ACTIVE, PENDING_AUTHORIZATION, REVOKED
  maxDebitPaise   Int      @default(100000)
  tokenId         String   @default("token_rzp_preauth_card")
  cardLast4       String   @default("4242")
  cardNetwork     String   @default("Visa")
  paymentLinkId   String?
  paymentLinkUrl  String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model AuditEvent {
  id           String   @id @default(cuid())
  eventType    String
  requestId    String?
  payloadJson  String
  previousHash String
  eventHash    String   // SHA256(previousHash + payloadJson + eventType + createdAt)
  createdAt    DateTime @default(now())
}
```

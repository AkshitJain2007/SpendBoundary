# SpendBoundary — Architecture

## 1. Architecture goal

Keep the architecture small enough for a 48-hour hackathon while making the important trust boundaries obvious:

```text
AI agent proposes
→ server validates
→ policy engine decides
→ human approves when required
→ test/mock payment runs
→ verified event is appended to audit log
```

The AI agent must never directly call the payment provider or write payment status.

## 2. Recommended stack

Use one main language where possible.

- **Frontend/API:** TypeScript with Next.js.
- **UI:** React, Tailwind CSS and a small component library.
- **Database:** SQLite with Prisma for the demo.
- **Policy engine:** Pure TypeScript functions with unit tests.
- **AI agent:** Tool-calling through one provider adapter; use a scripted mock agent if the API key is unavailable.
- **Payment:** Razorpay Test Mode adapter plus a local mock adapter.
- **Audit:** SQLite append-only event table plus SHA-256 hash chain.
- **Validation:** Zod or shared TypeScript schemas.
- **Testing:** Vitest/Jest for unit tests and Playwright for one smoke test.
- **Optional:** Docker Compose for the database/app, but do not make Docker mandatory if it slows the team.

## 3. High-level components

### 3.1 Web application

Screens:

- Merchant policy screen.
- Catalogue screen.
- Agent conversation/action screen.
- Checkout review screen.
- Human approval screen.
- Payment status screen.
- Audit replay screen.

### 3.2 Agent service

The agent receives a user goal and calls only typed tools. It returns a proposed action, not an approved payment.

Example tools:

```text
search_catalogue(query)
get_product(product_id)
add_to_cart(product_id, quantity)
get_cart()
request_checkout(cart_id, stated_reason)
get_approval_status(request_id)
```

### 3.3 Policy engine

A pure function that accepts a normalised request and current policy state:

```text
PolicyInput → PolicyDecision
```

It must not depend on the LLM or UI.

### 3.4 Payment adapter

Create a common interface:

```ts
interface PaymentGateway {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  fetchStatus(orderId: string): Promise<PaymentStatus>;
}
```

Implement:

- `MockPaymentGateway` — always available for the demo.
- `RazorpayTestGateway` — used when test credentials and setup are ready.

### 3.5 Audit service

One service appends events and verifies the chain.

```text
appendEvent(event) → event_hash
verifyChain() → { valid, first_invalid_event }
replayRequest(request_id) → ordered events
```

Do not allow normal update/delete routes for audit events.

## 4. Request flow

### 4.1 Normal allowed purchase

```text
User goal
  ↓
Agent searches catalogue
  ↓
Agent builds cart
  ↓
Backend recalculates total
  ↓
Policy engine returns ALLOW
  ↓
Internal payment request created
  ↓
Mock/Razorpay Test order created
  ↓
Payment event received/confirmed
  ↓
Audit event appended
```

### 4.2 Denied purchase

```text
Agent requests ₹8,000 purchase
  ↓
Backend recalculates amount
  ↓
Policy engine sees ₹2,000 cap
  ↓
DENY
  ↓
No payment call
  ↓
Denied request appended to audit log
```

### 4.3 Review purchase

```text
Request
  ↓
Policy returns REVIEW
  ↓
Approval screen
  ↓
Human approves/rejects
  ↓
If approved, create one payment attempt
```

### 4.4 Failed/repeated payment

```text
Internal request ID created once
  ↓
Payment attempt uses one idempotency key
  ↓
Timeout/retry
  ↓
Same request ID and same key reused
  ↓
Existing attempt checked
  ↓
No duplicate payment order
```

Razorpay webhooks are asynchronous; verify the webhook signature and deduplicate repeated event IDs [1](https://razorpay.com/docs/webhooks/) [2](https://razorpay.com/docs/webhooks/validate-test/).

## 5. Repository structure

```text
agent-till/
├── app/
│   ├── page.tsx                         # landing/demo screen
│   ├── catalogue/page.tsx
│   ├── agent/page.tsx
│   ├── approval/page.tsx
│   ├── audit/page.tsx
│   └── api/
│       ├── agent/route.ts
│       ├── catalogue/route.ts
│       ├── cart/route.ts
│       ├── checkout/route.ts
│       ├── policy/route.ts
│       ├── approvals/route.ts
│       ├── payments/route.ts
│       ├── payments/webhook/route.ts
│       └── audit/route.ts
├── components/
│   ├── PolicyBadge.tsx
│   ├── DecisionCard.tsx
│   ├── CartSummary.tsx
│   ├── ApprovalCard.tsx
│   ├── AuditTimeline.tsx
│   └── DemoControls.tsx
├── lib/
│   ├── schemas.ts                       # shared Zod schemas
│   ├── policy-engine.ts                 # pure deterministic rules
│   ├── cart-total.ts                    # server-side amount calculation
│   ├── audit-chain.ts                   # hash chain
│   ├── idempotency.ts
│   ├── agent/
│   │   ├── tools.ts
│   │   ├── agent-adapter.ts
│   │   └── mock-agent.ts
│   └── payments/
│       ├── gateway.ts
│       ├── mock-gateway.ts
│       └── razorpay-test-gateway.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── tests/
│   ├── policy-engine.test.ts
│   ├── payment-retry.test.ts
│   ├── audit-chain.test.ts
│   └── smoke.spec.ts
├── public/
├── docs/
│   ├── assumptions.md
│   └── demo-script.md
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

## 6. Data flow and trust boundaries

### Untrusted inputs

- Natural-language user goal.
- AI tool arguments.
- Browser cart values.
- Payment redirect values.
- Webhook payload before signature verification.

### Trusted only after validation

- Server-recalculated cart total.
- Validated product IDs and quantities.
- Policy decision from the pure engine.
- Human approval stored by the server.
- Verified payment webhook.

### Never trust

- Amount supplied by the agent.
- “Payment successful” text from the browser.
- An LLM statement that a policy was satisfied.
- A client-side approval flag.

## 7. API contract

### `POST /api/agent`

Input:

```json
{ "goal": "Buy a notebook under 500", "session_id": "demo_1" }
```

Output:

```json
{ "message": "I found two options", "tool_events": [], "next_action": "review_cart" }
```

### `POST /api/checkout`

Input:

```json
{ "cart_id": "cart_1", "agent_id": "agent_demo", "reason": "Buy office supplies" }
```

Server actions:

1. Load cart from database.
2. Recalculate total.
3. Validate policy input.
4. Evaluate policy.
5. Append decision event.
6. If ALLOW, create payment attempt.
7. If REVIEW, create approval request.
8. If DENY, return reasons.

### `POST /api/payments/webhook`

Server actions:

1. Read raw body.
2. Verify provider signature.
3. Check event ID has not already been processed.
4. Update payment attempt through a controlled transition.
5. Append audit event.
6. Return success response.

### `GET /api/audit/:requestId`

Returns ordered events and chain status:

```json
{ "valid": true, "events": [] }
```

## 8. Database rules

- Normal entities can be updated through controlled routes.
- `AuditEvent` has no delete route.
- Audit payload is stored as canonical JSON before hashing.
- `event_hash = SHA256(previous_hash + canonical_payload + event_type + timestamp)`.
- Store all money values as integer paise, never floating-point rupees.
- Store policy version with every decision.
- Store an internal request ID and idempotency key for every payment attempt.

## 9. Payment integration plan

### First choice

Build the local mock gateway first. It should support:

- `created`.
- `authorized`.
- `captured`.
- `failed`.
- `timeout`.

### Razorpay Test Mode

Add the adapter only after the mock flow passes. Razorpay Test Mode uses test credentials and does not process real money [3](https://razorpay.com/docs/x/get-started/test-mode/).

Keep keys server-side in environment variables. Use test-mode webhooks where possible. If webhook setup is unavailable, replay a signed/mock event locally and label it as simulated.

## 10. AI integration plan

### Agent adapter

Keep the provider behind:

```ts
interface AgentModel {
  respond(input: AgentInput, tools: ToolDefinition[]): Promise<AgentResponse>;
}
```

Implement:

- `LiveAgentModel` — provider API.
- `ScriptedAgentModel` — deterministic demo fallback.

### Tool-call validation

Every tool argument is validated with the shared schema. A failed validation returns a safe tool error; it does not execute partial actions.

### AI output contract

```json
{
  "type": "tool_call | message",
  "tool": "request_checkout",
  "arguments": {},
  "confidence": 0.81
}
```

The policy engine does not use the confidence value to allow a payment. Confidence can be shown for explanation only.

## 11. Observability for the demo

Show a small developer panel with:

- Request ID.
- Policy version.
- Decision.
- Reasons.
- Payment attempt ID.
- Idempotency key (masked).
- Audit chain status.

Do not show secrets or full sensitive values.

## 12. Local run commands

The final repository should support something like:

```bash
npm install
cp .env.example .env.local
npm run db:seed
npm run dev
```

Add a `DEMO_MODE=true` option so the whole demo works without external keys.

## 13. Architecture acceptance tests

- Agent cannot call payment adapter directly.
- Client cannot change a server-calculated total.
- DENY never creates a payment attempt.
- REVIEW cannot pay without approval.
- Duplicate webhook does not duplicate the payment state transition.
- Audit tampering is detected.
- Mock gateway works without network.

# SpendBoundary — Product Requirements Document

**Hackathon:** 48-hour local VIT hackathon  
**Project type:** FinTech + AI/ML + DevTools & Infra  
**Status:** Build-ready PRD for a hackathon prototype  
**Payment mode:** Razorpay Test Mode or a local mock payment adapter only

## 1. Product summary

SpendBoundary is a merchant-side trust layer for AI buyers. An AI agent can browse a small product catalogue and request a purchase, but it cannot directly spend money.

Every request passes through a deterministic policy gate. The gate returns:

- **ALLOW** — the request is within policy.
- **REVIEW** — a human must approve it.
- **DENY** — the request breaks a policy.

Every agent action, policy decision, approval and payment event is saved in a tamper-evident audit trail.

## 2. Problem statement

AI agents can browse products, build carts and initiate payments, but merchants do not have a transparent way to control what an agent may buy, how much it may spend, how often it may try and whether a retry could create a duplicate payment.

## 3. Goal

Build a working demonstration of a safe AI-commerce checkout where:

1. An AI agent can shop through approved tools.
2. A merchant can define spending and product policies.
3. A server-side policy engine allows, reviews or denies each request.
4. Human approval is required for selected transactions.
5. Razorpay Test Mode or a mock gateway records the approved payment.
6. Duplicate retries do not create duplicate payment attempts.
7. The full history can be replayed and checked for tampering.

## 4. Target users

### Primary user — Merchant/operator

A small online merchant or platform operator who wants an AI agent to help with purchases but wants control over money and products.

### Secondary user — Risk/admin reviewer

A person who reviews high-value or unusual transactions and checks why the policy engine made a decision.

### System actor — AI buyer agent

The agent searches the catalogue, creates a cart and requests checkout. It is not trusted to approve its own payment.

## 5. Main user story

> “I want an AI buyer to complete small approved purchases, but I want every transaction checked against my rules and every action recorded so I can understand and stop unsafe behaviour.”

## 6. Hackathon demo story

Use one merchant, six products and one AI buyer agent.

1. The agent asks for a product under a budget.
2. It searches the catalogue and adds an item to a cart.
3. A valid ₹500 request is allowed.
4. The agent tries to purchase an ₹8,000 item while its limit is ₹2,000.
5. The policy gate denies it and explains the violated rule.
6. The agent tries several purchases quickly and hits a velocity limit.
7. A medium-risk order goes to human approval.
8. An approved test payment is created.
9. A network retry is replayed; the system keeps one payment attempt using the same idempotency key.
10. The audit screen replays allowed, reviewed and denied actions.
11. A test edit is made to an old audit event; the hash-chain check reports tampering.

## 7. Core features — must build

### F1. Merchant catalogue

- Six demo products.
- Product name, category, price, stock and allowed/blocked status.
- The AI agent can search and view only catalogue data exposed through tools.

### F2. Policy configuration

Minimum policies:

- Maximum order value.
- Daily spend limit.
- Allowed categories/SKUs.
- Maximum requests within a time window.
- Human approval threshold.
- Denied products.

### F3. AI agent tool use

The agent may call only approved tools:

- Search catalogue.
- Get product details.
- Add/remove cart item.
- Calculate cart total through the server.
- Request checkout.
- Ask for approval status.

The agent must not call the payment gateway directly.

### F4. Deterministic policy gate

For every checkout request, return:

```json
{
  "decision": "ALLOW | REVIEW | DENY",
  "reasons": ["daily_limit_exceeded"],
  "policy_version": "v1",
  "request_id": "req_123"
}
```

### F5. Human approval

- Show the cart, amount, agent reason and violated/triggered policy.
- Approver can approve or reject.
- Approval expires after a short period.
- The approval is recorded in the audit log.

### F6. Test payment adapter

- Razorpay Test Mode adapter if credentials and setup are available.
- Local mock adapter must always be available.
- Never use live payment mode.

### F7. Safe retry handling

- Create one internal request ID before payment.
- Reuse the same idempotency key for a retry of the same request.
- Do not create a new order when the original request is still processing.
- Deduplicate repeated webhook/event IDs.

### F8. Audit trail and replay

Record:

- Agent request.
- Tool call.
- Cart snapshot.
- Policy version and decision.
- Approval decision.
- Payment order/attempt status.
- Webhook/event ID.
- Retry and error events.

The audit trail should be append-only at application level and hash-linked for tamper detection.

## 8. Features that are optional

Only build these after the core demo works:

- Natural-language policy editor that converts text into a draft policy for human confirmation.
- AI explanation of a denied request.
- Multiple merchant policies.
- CSV export.
- Small risk dashboard.
- Dark/light theme switch.

## 9. Explicitly out of scope

- Live payments.
- Real bank, card, UPI or wallet credentials.
- Real customer data.
- Multi-merchant settlement.
- Refunds, chargebacks or tax invoices.
- Full e-commerce storefront.
- Autonomous human approval.
- Blockchain.
- Face recognition or identity verification.
- A claim that SpendBoundary prevents all fraud.

## 10. Functional requirements

### FR1 — Catalogue access

The agent can search only approved products and receives structured results.

### FR2 — Server-side amount calculation

The backend recalculates product price, quantity, discounts and total. It never trusts a total sent by the agent.

### FR3 — Policy decision

The policy engine evaluates every checkout request before a payment order is created.

### FR4 — Policy explanations

Every DENY or REVIEW result shows the exact rule and values that caused it.

### FR5 — Approval boundary

A REVIEW request cannot become paid without a valid human approval.

### FR6 — Payment boundary

Only an ALLOW decision or approved REVIEW decision can call the payment adapter.

### FR7 — Retry safety

The same request cannot create two successful payment attempts because of a repeated call.

### FR8 — Audit integrity

The system can verify the hash chain and identify an altered event.

### FR9 — Failure fallback

If the LLM, payment provider or webhook is unavailable, the system shows a clear error and can run the scripted demo/mock adapter.

## 11. Non-functional requirements

- Core demo must run locally with one documented command.
- No secret keys in source code or browser code.
- API responses must be JSON and versioned.
- Policy decisions must be deterministic and testable.
- User interface must be understandable without reading the source code.
- All demo data must be synthetic and labelled.
- The demo should complete in under three minutes.
- Basic unit tests must cover policy rules, amount calculation, retry deduplication and audit verification.

## 12. Minimum data model

### Product

`id, name, category, price_paise, stock, allowed, description`

### Policy

`id, merchant_id, max_order_paise, daily_limit_paise, velocity_count, velocity_window_seconds, allowed_categories, approval_threshold_paise, version`

### AgentRequest

`id, agent_id, cart_snapshot, requested_amount_paise, reason, created_at, status`

### PolicyDecision

`id, request_id, decision, reasons, policy_version, evaluated_at`

### Approval

`id, request_id, reviewer_id, decision, comment, expires_at, created_at`

### PaymentAttempt

`id, request_id, provider, provider_order_id, idempotency_key, status, amount_paise, created_at`

### AuditEvent

`id, event_type, request_id, payload_json, previous_hash, event_hash, created_at`

## 13. Success metrics for the demo

- 100% of checkout requests pass through the policy gate.
- 0 payment calls for DENY requests.
- 100% of REVIEW requests require approval.
- Repeated payment request creates no duplicate successful attempt.
- All demo events are replayable.
- Tampering with one event is detected.
- Every decision has a readable reason.

These are prototype metrics, not production fraud-prevention claims.

## 14. Budget

- Software and local mock gateway: ₹0.
- Razorpay Test Mode: no real money; use test credentials only.
- Optional hosting/demo tunnel: ₹0–₹2,000.
- Optional domain or presentation material: ₹0–₹1,000.
- Estimated hackathon budget: **₹0–₹3,000**.

## 15. Risks and responses

| Risk | Response |
|---|---|
| LLM gives the wrong tool arguments | Validate every argument server-side and use typed schemas. |
| Agent tries to change the amount | Recalculate the total on the server. |
| Payment webhook repeats | Deduplicate event IDs and use idempotency. |
| Razorpay setup fails | Switch to the local mock adapter without changing the policy flow. |
| Audit log is edited | Verify the hash chain and show the tamper alert. |
| Judges call it a normal payment gateway | Show the agent-specific policy layer and denied-agent demo. |
| Team overbuilds e-commerce | Keep one merchant, six products and one checkout path. |

## 16. Definition of done

The project is done when a judge can see one agent make an allowed purchase, one overspend attempt get denied, one review request get approved, one retry get deduplicated and one audit tampering attempt get detected—all without real money or sensitive data.

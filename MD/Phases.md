# SpendBoundary — 48-Hour Build Phases

## Phase 0 — Team agreement and scope freeze

**Time:** Hour 0–2  
**Owner:** Sajag + whole team

### Do

- Read the PRD together.
- Freeze one merchant, six products, one AI agent and one checkout flow.
- Agree on policy values:
  - Maximum order: ₹2,000.
  - Daily limit: ₹5,000.
  - Review threshold: ₹1,000.
  - Velocity limit: 3 requests in 60 seconds.
- Decide Mock Gateway first; Razorpay Test Mode is optional.
- Create repository and `.env.example`.

### Done when

- Everyone can explain the problem in one sentence.
- One demo story is written.
- No one is building a marketplace, blockchain or live payment feature.

## Phase 1 — Repository, schemas and seed data

**Time:** Hour 1–5  
**Owner:** Sajag, Sampurna, Ishna

### Do

- Create monorepo structure.
- Define shared schemas for Product, Cart, AgentRequest, PolicyDecision, Approval, PaymentAttempt and AuditEvent.
- Create SQLite/Prisma schema.
- Add six fake products.
- Add one default policy.
- Add `/demo/seed`.
- Add `/health`.

### Done when

- Database seeds successfully.
- Frontend and backend agree on JSON shapes.
- Tests can load known products and policies.

## Phase 2 — Catalogue and merchant policy screens

**Time:** Hour 3–9  
**Owner:** Sanvi + Shrishti

### Do

- Build catalogue page.
- Build simple policy configuration page.
- Add product/category allow and deny status.
- Add spend limit and approval threshold controls.
- Display `DEMO MODE`.

### Done when

- A merchant can see products and policy values.
- UI uses mock/API data without waiting for the AI agent.

## Phase 3 — Deterministic policy engine

**Time:** Hour 4–12  
**Owner:** Aryan + Sampurna

### Do

- Implement server-side cart total calculation.
- Implement hard constraints.
- Implement ALLOW/REVIEW/DENY decisions.
- Return rule IDs, values and reasons.
- Add tests for:
  - Under limit.
  - Over order limit.
  - Daily limit exceeded.
  - Blocked product.
  - Velocity limit.
  - Missing data.

### Done when

- Policy tests pass.
- No frontend value can override the server total.
- A denied request cannot call the payment adapter.

## Phase 4 — Agent tool-calling flow

**Time:** Hour 8–17  
**Owner:** Sanvi + Aryan

### Do

- Create typed catalogue/cart/checkout tools.
- Add scripted mock agent first.
- Add live LLM adapter only if time and key are available.
- Show agent messages and tool events.
- Add invalid-argument handling.

### Done when

- The agent can search, add to cart and request checkout.
- The same demo works with the live model or mock agent.
- The agent cannot call payment directly.

## Phase 5 — Human approval flow

**Time:** Hour 12–20  
**Owner:** Shrishti + Sampurna

### Do

- Build review queue.
- Show cart, amount, reason and triggered policy.
- Add approve/reject buttons.
- Add expiry.
- Store reviewer decision.

### Done when

- REVIEW cannot pay before approval.
- Approval and rejection appear in the audit timeline.

## Phase 6 — Mock payment and Razorpay Test adapter

**Time:** Hour 16–26  
**Owner:** Sampurna + Aryan

### Do

- Implement `MockPaymentGateway` first.
- Add test states: created, captured, failed, timeout.
- Add internal request ID and idempotency key.
- Add duplicate retry test.
- Add Razorpay Test Mode adapter only after mock works.
- Keep all keys server-side.

### Done when

- Allowed request creates one mock/test order.
- Denied request creates no order.
- Retry reuses the same logical payment attempt.

## Phase 7 — Audit chain and replay

**Time:** Hour 20–30  
**Owner:** Ishna + Sampurna

### Do

- Append event for every important action.
- Add previous hash and event hash.
- Build audit timeline.
- Add `verifyChain()`.
- Add a demo tamper button that changes a local test event only.
- Show tamper detected.

### Done when

- Allowed, REVIEW, DENY, approval, payment and retry events are visible.
- One altered event breaks verification.

## Phase 8 — Integration and scenario testing

**Time:** Hour 26–36  
**Owner:** Sajag + whole team

### Scenarios

1. Valid ₹500 purchase → ALLOW → payment captured.
2. ₹8,000 purchase with ₹2,000 cap → DENY → no payment.
3. Blocked product → DENY.
4. Three quick requests → velocity DENY.
5. ₹1,500 request → REVIEW → human approval → payment.
6. Payment timeout → same-key retry → no duplicate.
7. Duplicate webhook → one state transition.
8. Old audit edit → tamper detected.
9. LLM unavailable → scripted agent works.
10. Razorpay unavailable → mock gateway works.

### Done when

- All scenarios pass in a clean database.
- The team has a recorded backup demo.

## Phase 9 — UX polish and pitch

**Time:** Hour 34–42  
**Owner:** Shrishti + Ishna + presenter

### Do

- Add clear decision badges.
- Add policy reason cards.
- Add agent-action timeline.
- Add one simple architecture diagram.
- Add problem, difference, demo, impact, cost and limitations slides.
- Remove unnecessary features.

### Done when

- A non-technical judge understands the project in 30 seconds.
- The main demo takes under three minutes.

## Phase 10 — Freeze, audit and final submission

**Time:** Hour 42–48  
**Owner:** Sajag + whole team

### Final audits

- CRUD audit: policy engine and audit chain are visible; it is not just a store.
- Payment audit: no live mode, no secrets, no duplicate retry.
- AI audit: model cannot bypass policy; mock fallback works.
- Data audit: only fake products/users/payments.
- Demo audit: success, deny, review, retry and tamper cases work.
- Presentation audit: no unsupported “prevents all fraud” claim.

### Freeze rules

- No new feature after Hour 42.
- Record a backup video.
- Tag the final commit.
- Export README and setup instructions.
- Keep a copy of the demo database.

## Parallel work map

| Person | Main responsibility | Backup responsibility |
|---|---|---|
| Sajag | Integration, API contract, final demo | Backend fixes |
| Sanvi | Agent UI and catalogue | Agent tool flow |
| Sampurna | Backend, database and payments | Policy integration |
| Shrishti | UX, approval and audit screens | Presentation visuals |
| Ishna | Test data, tests and audit verification | Research/pitch |
| Aryan | Policy engine, optimiser logic and AI adapter | Payment/retry tests |

## What to cut first if behind schedule

- Live LLM integration.
- Live Razorpay integration.
- Advanced charts.
- Natural-language policy creation.
- Multiple merchants.

Keep the scripted agent, mock payment, policy gate and audit replay. Those four pieces make the project demoable.

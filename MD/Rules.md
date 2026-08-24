# SpendBoundary — Rules for AI Coding Agents

This file is the boundary for every AI coding tool working on SpendBoundary.

## 1. Priority order

1. Keep the payment-safety boundary correct.
2. Make the policy engine deterministic and testable.
3. Make the demo work without external services.
4. Keep the UI clear.
5. Add optional AI features only after the core works.

## 2. Allowed technology choices

Use the agreed stack unless the team lead changes it:

- TypeScript.
- Next.js/React.
- Tailwind CSS.
- Prisma with SQLite for the hackathon.
- Zod for validation.
- A small tool-calling AI SDK/provider adapter.
- Razorpay Test Mode only.
- Local mock payment gateway.
- SHA-256 from a standard crypto library for the audit chain.
- Vitest/Jest and one Playwright smoke test.

## 3. Avoid

- Live payment mode.
- Real UPI PINs, cards, bank accounts or customer data.
- Blockchain or smart contracts.
- Multiple payment providers.
- A full marketplace or e-commerce platform.
- Direct LLM access to the database.
- Direct LLM access to payment APIs.
- Client-side policy decisions.
- Client-side payment-success decisions.
- Random unreviewed dependencies.
- Large AI models trained during the hackathon.
- Web scraping of private or unauthorised systems.

## 4. AI agent rules

The AI agent is an untrusted requester.

It may:

- Search approved products.
- Read product descriptions.
- Build a cart through tools.
- Request checkout.
- Explain a policy decision.

It may not:

- Approve its own payment.
- Change a policy.
- Change the server-calculated total.
- Call Razorpay directly.
- Read secrets or environment variables.
- Write directly to the database.
- Mark a payment as successful.
- Retry with a new payment ID to bypass a failed request.
- Ask the user for card numbers, CVV, OTPs, UPI PINs or passwords.

## 5. Policy engine rules

The policy engine must be a pure deterministic function.

Minimum checks:

- Maximum order value.
- Daily spend limit.
- Allowed/blocked product or category.
- Number of requests per time window.
- Human-approval threshold.
- Stock and quantity limits.

Decision rules:

- Hard violation → `DENY`.
- High-value or configured sensitive action → `REVIEW`.
- All checks pass → `ALLOW`.
- Missing data or uncertain state → `REVIEW` or safe failure, never silent `ALLOW`.

Every decision must include:

- Rule ID.
- Actual value.
- Limit.
- Policy version.
- Human-readable reason.

## 6. Payment rules

- Never use live mode.
- Calculate all totals on the server.
- Use integer paise for money.
- Create an internal request ID before creating a provider order.
- Use one idempotency key per logical payment request.
- Reuse the same key on a retry of the same request.
- Never create a second order just because the first response timed out.
- Verify webhook signatures before processing events.
- Deduplicate webhook/event IDs.
- Handle webhook events arriving out of order.
- Do not trust browser redirects as the final payment state.
- Use a mock gateway when the provider is unavailable.

## 7. Audit-log rules

- Audit events are append-only at the application level.
- There is no delete endpoint for audit events.
- Do not mutate old event payloads.
- Canonicalise JSON before hashing.
- Link each event to the previous event hash.
- Include request ID and policy version.
- Log denied attempts as well as successful payments.
- Mask secrets, full payment credentials and unnecessary personal data.
- Provide a chain-verification function and a tamper demonstration.

## 8. Data rules

- Use six fake products.
- Use fake merchant and agent IDs.
- Use fake amounts and timestamps.
- Use synthetic requests and policy outcomes.
- Do not include real customer information.
- Do not upload personal data to an LLM.
- Do not store API keys in Git.
- Use `.env.example` with placeholder values.
- Mark the UI clearly as `DEMO MODE` or `TEST MODE`.

## 9. API rules

- Validate every request body.
- Reject unknown or invalid fields when safety matters.
- Return stable JSON error shapes.
- Use HTTP status codes correctly.
- Do not expose stack traces to the browser.
- Do not let the frontend call provider secrets.
- Keep provider-specific code inside the payment adapter.
- Keep policy logic outside route handlers.
- Add a `/health` endpoint.
- Add a `/demo/seed` endpoint.

## 10. Error-handling rules

Use this shape:

```json
{
  "error": {
    "code": "POLICY_DENIED",
    "message": "The order exceeds the agent daily limit.",
    "request_id": "req_123",
    "retryable": false
  }
}
```

Rules:

- Never hide a payment failure.
- Never retry a non-retryable policy denial.
- Never retry a payment with a new idempotency key automatically.
- Show the user what action is safe next.
- Log the error as an audit event when it belongs to a request.
- If the AI provider fails, use the scripted demo agent.
- If Razorpay fails, use the mock gateway.
- If the database fails, show a clear demo error; do not pretend payment succeeded.

## 11. Coding-agent behaviour

Before changing code, the agent must:

1. Read `PRD.md`, `Architecture.md` and `Phases.md`.
2. State which phase it is working on.
3. Show the files it plans to change.
4. State assumptions.
5. Avoid unrelated refactors.
6. Add or update tests for logic changes.

After changing code, the agent must:

1. Run formatting/linting if available.
2. Run relevant tests.
3. Summarise files changed.
4. Report known limitations.
5. Update the phase status if the task is complete.

## 12. Vibe-coding and parallel work

- Use one branch per feature or one folder per agent.
- Do not have two agents edit the same core file simultaneously.
- Agree on schemas before parallel coding.
- Frontend can use mock JSON while backend is being built.
- Engine must expose a pure function with stable input/output.
- Merge only after a smoke test.
- Do not let an AI agent silently change the API contract.
- Keep one branch that always runs.

## 13. Scope-control rules

When time is short, remove features in this order:

1. Natural-language policy editor.
2. Live AI provider; use scripted agent.
3. Real Razorpay adapter; use mock gateway.
4. Charts and extra dashboard pages.
5. Multiple policy types.

Never remove:

- Server-side amount calculation.
- Deterministic policy gate.
- Allow/review/deny result.
- Human approval boundary.
- Retry deduplication.
- Audit trail and chain verification.

## 14. Security-testing rule

Only test the local project and deliberately created demo endpoints. Do not scan VIT systems, public websites, third-party APIs or payment infrastructure.

## 15. Definition of a safe AI feature

An AI feature is acceptable only if:

- Its input is known.
- Its output schema is known.
- Its failure mode is handled.
- Its confidence or uncertainty is visible where useful.
- A deterministic fallback exists.
- It cannot bypass a policy or payment boundary.

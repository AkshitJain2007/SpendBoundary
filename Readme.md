# SpendBoundary

## Policy-Gated Payments for AI Agents

> **Let AI shop. Keep the merchant in control.**

SpendBoundary is a planned merchant-side trust layer for AI-powered commerce. An AI agent can search a catalogue, build a cart and request a purchase—but it never gets direct access to payment credentials or payment APIs.

Every request must pass through a deterministic policy gate:

```text
ALLOW  →  proceed to test/mock payment
REVIEW →  wait for a human decision
DENY   →  stop before payment creation
```

Every important action is recorded in a tamper-evident audit trail, so a merchant can see not only **what** happened, but **why** it happened.

---

| Area | Current plan |
|---|---|
| Application | To be built during the hackathon |
| Payment | Local mock gateway first; Razorpay Test Mode only if time permits |
| Data | Six fake products, synthetic users and demo transactions |
| AI | Scripted fallback required; live model adapter optional |
| Money | No real payments, credentials or customer data |
| Target demo | Under three minutes |

---

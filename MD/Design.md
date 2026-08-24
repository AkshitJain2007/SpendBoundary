# SpendBoundary — Design System

## 1. Design goal

The product should feel like a **trusted financial control room**: modern, calm and technical, but easy to understand during a short demo.

Do not make it look like a normal shopping app. The important visual elements are the policy decision, reason, approval boundary and audit trail.

## 2. Visual theme

### Theme

Dark navy base with white panels, blue highlights and clear decision colours.

### Colour palette

| Use | Colour | Hex |
|---|---|---|
| Main background | Deep navy | `#0B1220` |
| Secondary background | Blue navy | `#111C2E` |
| Card background | White | `#FFFFFF` |
| Main text on dark | Soft white | `#F8FAFC` |
| Main text on light | Charcoal | `#172033` |
| Primary accent | Electric blue | `#3B82F6` |
| AI/agent accent | Violet | `#8B5CF6` |
| ALLOW | Green | `#16A34A` |
| REVIEW | Amber | `#D97706` |
| DENY | Red | `#DC2626` |
| Audit/security | Teal | `#0F766E` |
| Border | Slate | `#CBD5E1` |
| Muted text | Grey | `#64748B` |

Do not use red for general warnings. Use red only for a denied or dangerous transaction.

## 3. Typography

- Preferred font: Inter.
- Fallback: system sans-serif.
- Page title: 28–32 px, semibold.
- Section title: 18–22 px, semibold.
- Body: 14–16 px.
- Small metadata: 12–13 px.
- Numbers/amounts: semibold or tabular numbers.
- Use sentence case, not all caps except short status badges.

## 4. Main layout

Desktop-first for judging, responsive for mobile.

```text
┌──────────────────────────────────────────────┐
│ SpendBoundary | Demo Mode | Merchant              │
├─────────────┬────────────────────────────────┤
│ Navigation  │ Main screen                     │
│             │                                │
│ Catalogue   │ Request / decision / audit      │
│ Policies    │                                │
│ Approvals   │                                │
│ Audit       │                                │
└─────────────┴────────────────────────────────┘
```

Keep the demo screen uncluttered. Judges should see the decision in less than two seconds.

## 5. Important components

### Decision badge

- `ALLOW` — green badge with check icon.
- `REVIEW` — amber badge with clock icon.
- `DENY` — red badge with stop icon.

Always show the reason beside the badge.

### Policy reason card

Example:

```text
DENIED
Order value exceeds agent limit
Requested: ₹8,000
Allowed: ₹2,000
No payment order was created.
```

### Agent activity card

Show:

- Agent goal.
- Tool used.
- Input summary.
- Result.
- Time.

Hide long raw JSON by default; provide an “inspect” option.

### Approval card

Show:

- Product/cart summary.
- Total amount.
- Why approval is needed.
- Policy triggered.
- Approve and reject buttons.
- Expiry time.

### Audit timeline

Use a vertical timeline with icons:

- Agent request.
- Catalogue search.
- Cart created.
- Policy decision.
- Human approval.
- Payment event.
- Retry.
- Tamper warning.

## 6. Screens

### 6.1 Demo home

Purpose: explain the product quickly.

Show:

- One-line problem.
- “Run safe purchase” button.
- “Run overspend attempt” button.
- “Run duplicate retry” button.
- Live decision panel.

### 6.2 Catalogue

Show six products as simple cards:

- Product name.
- Category.
- Price.
- Allowed/blocked status.
- Add to cart.

### 6.3 Agent console

Split view:

- Left: conversation and agent goal.
- Right: tool calls and cart.

Do not make it look like a generic chatbot. Label it “Agent actions.”

### 6.4 Policy screen

Show editable demo values:

- Maximum order value.
- Daily limit.
- Approval threshold.
- Velocity limit.
- Allowed categories.

Use sliders/number inputs with clear rupee values.

### 6.5 Decision screen

This is the main judging screen. Show:

- Request amount.
- Policy result.
- Exact reason.
- Whether payment was called.
- Next action.

### 6.6 Audit screen

Show:

- Request ID.
- Policy version.
- Event timeline.
- Payment attempt.
- Chain status: `Verified` or `Tampered`.

## 7. UX copy

Use direct, calm wording.

### Good

- “Payment blocked before order creation.”
- “Human approval required.”
- “The agent exceeded its daily limit.”
- “Retry matched the existing payment request.”
- “Audit chain verified.”
- “Demo data only.”

### Avoid

- “AI saved the day.”
- “100% fraud-proof.”
- “Autonomous payment success.”
- “The agent was evil.”
- “Guaranteed safe.”

## 8. Accessibility

- Keyboard navigation for all actions.
- Visible focus state.
- Do not use colour alone for ALLOW/REVIEW/DENY.
- Use icons and text together.
- Maintain readable contrast.
- Use clear labels for amounts and limits.
- Avoid flashing animations.
- Make error text actionable.

## 9. Demo visual hierarchy

For every transaction, show in this order:

1. **What did the agent request?**
2. **What was the amount?**
3. **What did the policy decide?**
4. **Why?**
5. **Was payment called?**
6. **What is recorded in the audit trail?**

## 10. Motion and interaction

Use light transitions only:

- Decision card fades in.
- Denied request briefly highlights the violated rule.
- Audit event appears in the timeline.

Do not spend hackathon time on elaborate animations.

## 11. Brand direction

- Logo idea: a small till/checkout icon inside a shield or gate.
- Use “SpendBoundary” only inside the project/demo UI. The idea-submission form can use the neutral idea description if required.
- Tagline for presentation: **“Let AI shop. Keep the merchant in control.”**

## 12. Responsive behaviour

On smaller screens:

- Convert side navigation to a top bar.
- Stack cart and decision panels.
- Keep the decision badge at the top.
- Keep the reason visible without scrolling.

## 13. Design acceptance checklist

- [ ] Judge can identify ALLOW/REVIEW/DENY immediately.
- [ ] Denial reason is visible without opening a developer console.
- [ ] Amounts use ₹ and are clearly formatted.
- [ ] “No payment was created” is shown for DENY.
- [ ] Approval screen shows exactly what is being approved.
- [ ] Audit timeline is readable.
- [ ] Test/demo mode is visible.
- [ ] No fake production claims appear in the UI.

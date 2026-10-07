# EZeeTC Unified MCP Server — Multi-Role Architecture
## One Server. Every Role. Always Current.

---

## The Vision

Instead of deploying separate MCP servers for each product (EZeeTC, EZeeTC Escrow, NexGen), we deploy **one MCP server** that adapts to the user's role. On first connection, Claude asks:

> **"What is your primary role?"**
> 1. Transaction Coordinator
> 2. Escrow Officer
> 3. Escrow Assistant
> 4. Realtor / Real Estate Agent
> 5. Real Estate Broker of Record
> 6. Compliance Officer

The answer determines which tools are exposed, what background data syncs, and how proactive alerts are filtered.

---

## Why One MCP, Not Many

| Factor | Separate MCPs | Unified MCP |
|--------|--------------|-------------|
| Deployment | N services × N deploys | 1 service, 1 deploy |
| Cloud Run cost | N × min instances | 1 × min instances |
| Shared data | Cross-service API calls | Direct internal access |
| User onboarding | "Which MCP do I install?" | "Install EZeeTC" → done |
| Code reuse | Duplicate GAS proxy logic | Single proxy, shared utils |
| Updates | Deploy N services | Deploy once |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Claude Desktop                    │
│            (mcp-remote → /mcp endpoint)          │
└──────────────────────┬──────────────────────────┘
                       │ Bearer Token Auth
                       ▼
┌─────────────────────────────────────────────────┐
│              EZeeTC MCP Server                   │
│                (Cloud Run)                       │
│                                                  │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Role Router  │  │   Session Manager        │  │
│  │             │  │   - role stored per       │  │
│  │ First msg → │  │     session               │  │
│  │ "What role?"│  │   - tool list filtered    │  │
│  └──────┬──────┘  │     by role               │  │
│         │         └──────────────────────────┘  │
│         ▼                                        │
│  ┌─────────────────────────────────────────┐    │
│  │           Tool Modules                   │    │
│  │                                          │    │
│  │  📋 TC Tools        (all roles)          │    │
│  │  📧 Email Tools     (all roles)          │    │
│  │  📞 Contact Tools   (all roles)          │    │
│  │  ✍️  DocuSign Tools  (TC, Escrow, Broker) │    │
│  │  💰 Escrow Tools    (Escrow only)        │    │
│  │  📊 Compliance Tools (Broker, Compliance)│    │
│  │  🏠 Listing Tools   (Realtor, Broker)    │    │
│  │  📈 Pipeline Tools  (Realtor, TC)        │    │
│  │  🔔 Alert Tools     (all roles)          │    │
│  └─────────────────────────────────────────┘    │
│                       │                          │
│                       ▼                          │
│  ┌─────────────────────────────────────────┐    │
│  │         GAS API Proxy Layer              │    │
│  │   (same backend for all roles)           │    │
│  └─────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│         Google Apps Script Backend               │
│    (EZeeTC Multi-Agent System — one codebase)    │
└─────────────────────────────────────────────────┘
```

---

## Role → Tool Matrix

| Tool Category | TC | Escrow Officer | Escrow Asst | Realtor | Broker | Compliance |
|--------------|:--:|:--------------:|:-----------:|:-------:|:------:|:----------:|
| **Transaction Management** | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| **Email Drafting** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Contact Lookup** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **DocuSign Send** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **DocuSign Status** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Escrow Instructions** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Wire Tracking** | ❌ | ✅ | ✅ | ❌ | ❌ | 👁️ |
| **Listing Management** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Offer Pipeline** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Disclosure Package** | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Deadline Alerts** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Compliance Audit** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Agent Performance** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Billing / Invoicing** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

✅ = full access | 👁️ = read-only | ❌ = hidden

---

## How Role Selection Works

### On First Connection (no role stored)

```javascript
// In session initialization
if (!session.role) {
  // Return a special "role_selection" resource
  // Claude sees it and asks the user to pick their role
  return {
    type: 'role_selection_required',
    prompt: 'What is your primary role?',
    options: ['Transaction Coordinator', 'Escrow Officer', ...]
  };
}
```

### Tool Filtering by Role

```javascript
// tools/index.js
const ROLE_TOOLS = {
  'transaction_coordinator': [
    ...transactionTools,
    ...emailTools,
    ...contactTools,
    ...docusignTools,
    ...disclosureTools,
    ...deadlineTools,
    ...billingTools,
  ],
  'escrow_officer': [
    ...transactionTools,
    ...emailTools,
    ...contactTools,
    ...docusignTools,
    ...escrowTools,
    ...wireTools,
    ...deadlineTools,
    ...billingTools,
  ],
  'realtor': [
    ...transactionTools,
    ...emailTools,
    ...contactTools,
    ...listingTools,
    ...offerTools,
    ...disclosureTools,
    ...deadlineTools,
  ],
  // ...
};

function getToolsForRole(role) {
  return ROLE_TOOLS[role] || ROLE_TOOLS['transaction_coordinator'];
}
```

### Session Storage

Role is stored per session and persists across reconnects:

```javascript
sessions.set(sessionId, {
  role: 'escrow_officer',
  transport: streamableTransport,
  createdAt: Date.now(),
});
```

---

## Background Sync (Phase 2)

Each role gets **proactive background updates** tailored to what matters:

| Role | Background Sync |
|------|----------------|
| **TC** | Deadline alerts, unsigned docs, missing items on checklist |
| **Escrow Officer** | Wire status changes, signing completions, recording deadlines |
| **Escrow Assistant** | New files assigned, document requests pending |
| **Realtor** | New offers, listing status changes, client messages |
| **Broker** | Compliance flags, agent performance, transaction volume |
| **Compliance** | Audit findings, missing disclosures, regulatory deadlines |

Implementation: A background worker polls GAS every N minutes per active session, pushes relevant notifications through the MCP session's server-sent events.

---

## Deployment (Same as Current)

No change to deployment — it's the same Cloud Run service:

```bash
gcloud run deploy ezeetc-mcp \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --set-env-vars "GAS_URL=$GAS_URL,MCP_BEARER_TOKEN=$BEARER_TOKEN"
```

The `--no-invoker-iam-check` flag and org policy override are already active.

---

## Claude Desktop Config (Same for Everyone)

Every user installs the same config — role is selected inside the MCP conversation:

```json
{
  "mcpServers": {
    "ezeetc": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://ezeetc-mcp-i7rvts7ntq-uw.a.run.app/mcp",
        "--header",
        "Authorization: Bearer TOKEN_HERE",
        "--transport",
        "http-only"
      ]
    }
  }
}
```

Future: Each user/company gets their own bearer token for multi-tenant isolation.

---

## Phased Rollout

### Phase 1 (NOW — Done ✅)
- TC tools (30+ tools)
- Bearer token auth
- Single-tenant (EZeeTC)

### Phase 2 (Next)
- Role selection on first connect
- Escrow tools module
- Tool filtering by role
- Per-company bearer tokens

### Phase 3 (Scale)
- Background sync per role
- Proactive alerts via SSE
- Multi-tenant (EZeeTC + NexGen + clients)
- OAuth per user (replace static bearer token)

### Phase 4 (SaaS)
- Self-service onboarding
- Stripe billing integration
- Usage metering per company
- Custom tool configurations per client

---

## Why This Wins

1. **One install**: Client installs once, picks their role, done
2. **One deploy**: Ship features to everyone simultaneously
3. **Shared data**: TC and Escrow Officer on the same transaction see the same data
4. **Lower cost**: One Cloud Run service instead of 3-5
5. **Faster iteration**: Add a tool once, decide which roles see it
6. **Clean upgrade path**: Role-based filtering → per-user OAuth → full SaaS

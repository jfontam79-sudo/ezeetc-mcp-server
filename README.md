# EZeeTC MCP Server

AI-powered Transaction Coordinator for California real estate. **30+ MCP tools** that automate email drafting, DocuSign workflows, deadline tracking, contact management, and daily briefings — reducing TC workload by 60-80%.

Built by [Marseille Capital DBA EZeeTC](https://ezeetc.com).

## Architecture

```
┌─────────────────┐     MCP Protocol      ┌──────────────────┐      POST        ┌─────────────────────┐
│  Claude Desktop  │ ──────────────────── │  EZeeTC MCP      │ ──────────────── │  Google Apps Script  │
│  or Claude.ai    │  tools/call + result  │  Server (Node.js)│  /exec endpoint  │  62,000+ lines       │
│  or Claude Code  │ ◄────────────────── │  Express + SDK   │ ◄──────────────── │  Gmail + Drive +     │
└─────────────────┘                       └──────────────────┘                   │  Sheets + DocuSign   │
                                                                                  └─────────────────────┘
```

## Tools Available (30+)

### Email Intelligence (4 tools)
| Tool | Description |
|------|-------------|
| `get_email_summary` | Prioritized email summary grouped by transaction with urgency levels |
| `get_email_detail` | Drill into specific email group with thread analysis |
| `draft_reply` | Draft an email reply using Gemini AI (saved as Gmail draft, not sent) |
| `send_draft` | Send a previously drafted email reply |

### Transaction Management (7 tools)
| Tool | Description |
|------|-------------|
| `get_transaction_status` | Current status, COE date, alerts for a property |
| `get_transaction_detail` | Full detail: parties, vendors, disclosures, timeline, alerts |
| `list_active_transactions` | Dashboard of all active escrows with filters |
| `get_transaction_timeline` | Key dates: inspection, appraisal, loan contingency, COE |
| `update_checklist` | Mark items as signed/received/completed |
| `get_daily_briefing` | Morning briefing — closings, overdue items, urgent emails |
| `list_escrows_by_date` | Escrows opened within a time range |
| `query_transactions` | Natural language questions about any transaction data |

### Contact & Vendor Lookup (5 tools)
| Tool | Description |
|------|-------------|
| `find_loan_officer` | Find LO from stored contacts or Gmail thread analysis |
| `find_loan_processor` | Find processor via self-ID scoring of Gmail threads |
| `find_escrow_officer` | Find escrow officer from email signatures |
| `get_contact_info` | Look up any person from the contact database |
| `refresh_contacts` | Re-scan Gmail threads to update contact info |

### DocuSign Automation (6 tools)
| Tool | Description |
|------|-------------|
| `send_disclosures` | Send buyer disclosure package (TDS, AVID, SPQ, etc.) via DocuSign |
| `send_purchase_contract` | Send California RPA with auto-populated fields |
| `send_counter_offer` | Send SCO, BCO, or SMCO via DocuSign |
| `send_addendum` | Send addendum (ADM) via DocuSign |
| `check_envelope_status` | Check who has signed, what's pending |
| `send_escrow_instructions` | Send escrow instructions for buyer/seller signing |

### TC Workflow Templates (8 tools)
| Tool | Description |
|------|-------------|
| `open_escrow` | Draft escrow opening package to escrow officer |
| `request_wire` | Draft wire instruction request to escrow |
| `send_welcome` | Draft welcome email introducing TC to both agents |
| `follow_up_lender` | Draft lender follow-up with smart LO lookup |
| `draft_email` | General-purpose email to anyone with CC support |
| `recover_missed_email` | Find emails missed by auto-intake |
| `add_buyer_email` | Add/update buyer email on a transaction |
| `send_pending_draft` | Send any previously created Gmail draft |

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
# Create .env file
cat > .env << 'EOF'
# GAS web app URL (your deployed Google Apps Script)
GAS_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec

# Optional: Bearer token for auth (leave empty for dev mode)
MCP_BEARER_TOKEN=

# Server port
PORT=3001
EOF
```

### 3. Start the server
```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 4. Test the health endpoint
```bash
curl http://localhost:3001/health
```

## Connect to Claude

### Claude Desktop (via mcp-remote)
Add to your Claude Desktop config:
```json
{
  "mcpServers": {
    "ezeetc": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3001/mcp", "--allow-http", "--transport", "http-only"]
    }
  }
}
```

### Claude Code (plugin)
Install the plugin:
```bash
claude plugin install ./ezeetc-mcp-server
```

### Claude.ai (custom connector)
Register as a connector at https://claude.ai/settings/connectors with the server URL.

### Cloud Deployment (production)
```bash
# Deploy to Google Cloud Run
gcloud run deploy ezeetc-mcp \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GAS_URL=your-gas-url,MCP_BEARER_TOKEN=your-token"
```

## Plugin Structure

```
ezeetc-mcp-server/
├── .claude-plugin/
│   ├── plugin.json              # Plugin metadata for Claude marketplace
│   ├── .mcp.json                # MCP server configuration
│   ├── skills/
│   │   └── tc-assistant/
│   │       └── SKILL.md         # TC domain expertise + tool routing
│   └── commands/
│       ├── morning-briefing.md  # /morning-briefing command
│       └── check-transaction.md # /check-transaction command
├── src/
│   ├── index.js                 # Express + MCP SDK server
│   ├── gas-proxy.js             # GAS web app proxy layer
│   ├── auth.js                  # Multi-tenant OAuth (Phase 2)
│   └── tools/
│       ├── email-tools.js       # 4 email intelligence tools
│       ├── transaction-tools.js # 7 transaction management tools
│       ├── contact-tools.js     # 5 contact/vendor lookup tools
│       ├── docusign-tools.js    # 6 DocuSign automation tools
│       └── workflow-tools.js    # 8 TC workflow template tools
├── package.json
├── Dockerfile
└── README.md
```

## Multi-Tenant Roadmap (Phase 2)

For marketplace distribution, each user will:
1. Install the EZeeTC plugin from Claude's marketplace
2. Authorize their Google Workspace via OAuth
3. Get a template spreadsheet cloned with all required tabs
4. Have GAS scripts auto-installed on their copy
5. Be routed to their own GAS backend on every tool call

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GAS_URL` | Yes | Your deployed GAS web app URL |
| `MCP_BEARER_TOKEN` | No | Auth token (empty = dev mode) |
| `PORT` | No | Server port (default: 3001) |
| `GOOGLE_CLIENT_ID` | Phase 2 | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Phase 2 | OAuth client secret |
| `TEMPLATE_SPREADSHEET_ID` | Phase 2 | Master template for new users |

## License

Proprietary — Marseille Capital DBA EZeeTC. All rights reserved.

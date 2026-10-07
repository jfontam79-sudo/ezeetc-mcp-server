/**
 * ============================================================
 * MCP Resources — Pre-loaded context for Claude
 * ============================================================
 * Resources let Claude access read-only data without a tool call.
 * They appear in Claude's context automatically, giving it
 * awareness of the user's current state.
 *
 * Resources registered:
 *   - ezeetc://transactions/active  → All active transactions
 *   - ezeetc://system/status        → Server + GAS health
 *   - ezeetc://help/commands        → Available commands reference
 *
 * Session 143 — 2026-10-02
 * ============================================================
 */

import { gasVoiceQuery, gasDirectAction } from "./gas-proxy.js";

export function registerResources(server) {

  // ── Active Transactions List ─────────────────────────────
  server.resource(
    "active-transactions",
    "ezeetc://transactions/active",
    {
      description: "List of all active transactions with addresses, COE dates, status, and transaction type. Updated on each read.",
      mimeType: "application/json",
    },
    async () => {
      try {
        const result = await gasVoiceQuery("show me all my active transactions dashboard");

        const transactions = result.dashboardData?.transactions || [];
        const summary = {
          totalActive: transactions.length,
          transactions: transactions.map(tx => ({
            address: tx.address || tx.addressShort || "Unknown",
            addressShort: tx.addressShort || "",
            fileStatus: tx.fileStatus || "",
            coeDate: tx.coeDate || "",
            transactionType: tx.transactionType || "",
            price: tx.price || "",
            buyerAgent: tx.buyerAgent || "",
            listingAgent: tx.listingAgent || "",
          })),
          closingThisWeek: transactions.filter(tx => {
            if (!tx.coeDate) return false;
            const coe = new Date(tx.coeDate);
            const now = new Date();
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            return coe >= now && coe <= weekFromNow;
          }).length,
          lastUpdated: new Date().toISOString(),
        };

        return {
          contents: [{
            uri: "ezeetc://transactions/active",
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2),
          }],
        };
      } catch (err) {
        return {
          contents: [{
            uri: "ezeetc://transactions/active",
            mimeType: "text/plain",
            text: `Error loading transactions: ${err.message}`,
          }],
        };
      }
    }
  );

  // ── System Status ────────────────────────────────────────
  server.resource(
    "system-status",
    "ezeetc://system/status",
    {
      description: "EZeeTC system health — server uptime, GAS connectivity, active sessions.",
      mimeType: "application/json",
    },
    async () => {
      const status = {
        server: "ezeetc-mcp",
        version: "2.1.0",
        uptime: process.uptime(),
        uptimeHuman: formatUptime(process.uptime()),
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        nodeVersion: process.version,
        gasUrl: process.env.GAS_URL ? "configured" : "default",
        authMode: process.env.MCP_BEARER_TOKEN ? "bearer_token" : "open",
        lastChecked: new Date().toISOString(),
      };

      // Quick GAS connectivity test
      try {
        const start = Date.now();
        await gasVoiceQuery("ping", {}, { timeout: 10000 });
        status.gasConnectivity = "ok";
        status.gasLatencyMs = Date.now() - start;
      } catch (err) {
        status.gasConnectivity = "error";
        status.gasError = err.message;
      }

      return {
        contents: [{
          uri: "ezeetc://system/status",
          mimeType: "application/json",
          text: JSON.stringify(status, null, 2),
        }],
      };
    }
  );

  // ── Commands Reference ───────────────────────────────────
  server.resource(
    "commands-reference",
    "ezeetc://help/commands",
    {
      description: "Complete reference of all EZeeTC MCP tools with descriptions and example usage.",
      mimeType: "text/markdown",
    },
    async () => {
      const reference = `# EZeeTC MCP — Tool Reference

## Email Intelligence
- **get_email_summary** — Prioritized inbox summary grouped by transaction
- **get_email_detail** — Drill into a specific email thread
- **draft_reply** — AI-composed reply based on your instructions
- **send_draft** — Send a previously drafted reply

## Transaction Management
- **get_transaction_status** — Quick status for any property address
- **get_transaction_detail** — Full detail card: parties, vendors, disclosures, timeline
- **list_active_transactions** — Dashboard of all active files
- **get_transaction_timeline** — Key dates and milestones
- **update_checklist** — Mark items as signed/received/completed
- **get_daily_briefing** — Morning briefing of what needs attention
- **list_escrows_by_date** — Escrows opened within a time range
- **query_transactions** — Natural language question about any transaction data

## Contact Lookup
- **find_loan_officer** — Discover the LO via cache + Gmail scan
- **find_loan_processor** — Self-ID scoring to find the processor
- **find_escrow_officer** — Find escrow officer from email signatures
- **get_contact_info** — Look up anyone by name
- **refresh_contacts** — Re-scan Gmail for updated contact info

## DocuSign Automation
- **send_disclosures** — Buyer disclosure package with anchor-based tabs
- **send_purchase_contract** — California RPA via template
- **send_counter_offer** — SCO, BCO, or SMCO
- **send_addendum** — ADM addendum
- **check_envelope_status** — Who signed, who hasn't
- **send_escrow_instructions** — EI for buyer/seller signing

## TC Workflow Automation
- **open_escrow** — Draft escrow opening package
- **request_wire** — Draft wire instruction request
- **send_welcome** — Welcome email to both agents
- **follow_up_lender** — Lender status follow-up
- **draft_email** — General-purpose email with smart contact resolution + CC
- **recover_missed_email** — Find and re-process missed inbox items
- **add_buyer_email** — Add buyer email for DocuSign
- **send_pending_draft** — Send any pending Gmail draft

*${new Date().toLocaleDateString()} — EZeeTC v2.1.0*
`;

      return {
        contents: [{
          uri: "ezeetc://help/commands",
          mimeType: "text/markdown",
          text: reference,
        }],
      };
    }
  );
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

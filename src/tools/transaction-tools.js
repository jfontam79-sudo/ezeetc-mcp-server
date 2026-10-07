/**
 * ============================================================
 * Transaction Tools — MCP tool definitions for transaction data
 * ============================================================
 * Maps to existing GAS actions:
 *   - STATUS (transaction status)
 *   - detail_card (rich detail with vendors/disclosures)
 *   - FILE_TIMELINE (key dates)
 *   - DASHBOARD (list all active transactions)
 *   - UPDATE_CHECKLIST (mark checklist items)
 *   - BRIEFING (daily briefing)
 * ============================================================
 */

import { z } from "zod";

export function registerTransactionTools(server, gasProxy) {

  // ── get_transaction_status ─────────────────────────────────
  server.tool(
    "get_transaction_status",
    "Get the current status of a specific transaction by address. Returns file status, close of escrow date, transaction type, and any alerts. Use when the user asks about the status of a property.",
    {
      address: z.string().describe("The property address or short name (e.g., 'Santa Fe', 'Rimview', '27407 Santa Fe Court')."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `What is the status of ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let status = `📋 Transaction Status: ${address}\n\n`;
        status += `${data.response || "No status available."}\n`;

        if (data.data) {
          const d = data.data;
          if (d.fileStatus) status += `\nFile Status: ${d.fileStatus}`;
          if (d.coeDate) status += `\nClose of Escrow: ${d.coeDate}`;
          if (d.transactionType) status += `\nType: ${d.transactionType}`;
          if (d.price) status += `\nPrice: ${d.price}`;
        }

        return {
          content: [
            { type: "text", text: status },
            { type: "text", text: `\n---\nRaw data:\n${JSON.stringify(data.data || {}, null, 2)}` },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error fetching status: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── get_transaction_detail ─────────────────────────────────
  server.tool(
    "get_transaction_detail",
    "Get rich transaction detail card including parties (buyer, seller, agents), vendors (loan officer, processor, escrow), disclosure progress, alerts, timeline, and contingencies. This is the comprehensive view of a transaction.",
    {
      address: z.string().describe("The property address to get details for."),
    },
    async ({ address }) => {
      try {
        // Use the detail_card endpoint directly
        const result = await gasProxy({
          action: "detail_card",
          address,
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        if (data.error) {
          return {
            content: [{ type: "text", text: `Transaction not found: ${data.error}` }],
            isError: true,
          };
        }

        let detail = `🏠 Transaction Detail: ${data.addressShort || address}\n\n`;

        // Parties
        if (data.parties) {
          detail += `PARTIES:\n`;
          if (data.parties.buyer) detail += `  Buyer: ${data.parties.buyer}\n`;
          if (data.parties.seller) detail += `  Seller: ${data.parties.seller}\n`;
          if (data.parties.listingAgent) detail += `  Listing Agent: ${data.parties.listingAgent}\n`;
          if (data.parties.buyerAgent) detail += `  Buyer Agent: ${data.parties.buyerAgent}\n`;
        }

        // Vendors
        if (data.vendors) {
          detail += `\nVENDORS:\n`;
          const v = data.vendors;
          if (v.loanOfficer) detail += `  Loan Officer: ${v.loanOfficer.name || "Unknown"} — ${v.loanOfficer.company || ""}\n`;
          if (v.loanProcessor) detail += `  Loan Processor: ${v.loanProcessor.name || "Unknown"} — ${v.loanProcessor.company || ""}\n`;
          if (v.escrowOfficer) detail += `  Escrow Officer: ${v.escrowOfficer.name || "Unknown"} — ${v.escrowOfficer.company || ""}\n`;
        }

        // Disclosures
        if (data.disclosures) {
          const disc = data.disclosures;
          detail += `\nDISCLOSURES: ${disc.signed || 0}/${disc.total || 0} signed`;
          if (disc.total > 0) detail += ` (${Math.round((disc.signed / disc.total) * 100)}%)`;
          if (disc.pending > 0) detail += ` — ${disc.pending} pending`;
          detail += "\n";
        }

        // Alerts
        if (data.alerts && data.alerts.length > 0) {
          detail += `\n⚠️ ALERTS:\n`;
          data.alerts.forEach(a => { detail += `  - ${a}\n`; });
        }

        // Timeline
        if (data.timeline) {
          detail += `\nTIMELINE:\n`;
          const t = data.timeline;
          if (t.openedEscrow) detail += `  Escrow Opened: ${t.openedEscrow}\n`;
          if (t.coeDate) detail += `  Close of Escrow: ${t.coeDate}\n`;
          if (t.inspectionDeadline) detail += `  Inspection Deadline: ${t.inspectionDeadline}\n`;
          if (t.appraisalDeadline) detail += `  Appraisal Deadline: ${t.appraisalDeadline}\n`;
          if (t.loanContingency) detail += `  Loan Contingency: ${t.loanContingency}\n`;
        }

        return {
          content: [
            { type: "text", text: detail },
            { type: "text", text: `\n---\nFull data:\n${JSON.stringify(data, null, 2)}` },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error fetching detail: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── list_active_transactions ───────────────────────────────
  server.tool(
    "list_active_transactions",
    "List all active transactions with their status, close of escrow dates, and key details. Returns the full dashboard view. Use when the user asks to see all their files, or wants an overview.",
    {
      filter: z.string().optional()
        .describe("Optional filter like 'buyer side', 'seller side', 'closing this week', etc."),
    },
    async ({ filter }) => {
      try {
        const queryText = filter
          ? `show me my ${filter} transactions`
          : "show me all my active transactions dashboard";

        const result = await gasProxy({
          action: "voice",
          text: queryText,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let list = `📊 Active Transactions\n\n`;
        list += `${data.response || "No transactions found."}\n`;

        if (data.dashboardData?.transactions) {
          list += `\nTotal: ${data.dashboardData.transactions.length} active files\n\n`;
          data.dashboardData.transactions.forEach((tx, i) => {
            list += `${i + 1}. ${tx.addressShort || tx.address || "Unknown"}\n`;
            if (tx.fileStatus) list += `   Status: ${tx.fileStatus}\n`;
            if (tx.coeDate) list += `   COE: ${tx.coeDate}\n`;
            if (tx.transactionType) list += `   Type: ${tx.transactionType}\n`;
            list += "\n";
          });
        }

        return {
          content: [{ type: "text", text: list }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error listing transactions: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── get_transaction_timeline ───────────────────────────────
  server.tool(
    "get_transaction_timeline",
    "Get the key dates and milestones for a transaction — escrow open, contingency deadlines, close of escrow, etc.",
    {
      address: z.string().describe("The property address to get timeline for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `What is the timeline on ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        return {
          content: [{
            type: "text",
            text: `📅 Timeline: ${address}\n\n${data.response || "No timeline data available."}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error fetching timeline: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── update_checklist ───────────────────────────────────────
  server.tool(
    "update_checklist",
    "Mark checklist items as signed, received, or completed for a transaction. Requires explicit user confirmation before executing.",
    {
      address: z.string().describe("The property address."),
      items: z.string().describe("Description of which items to update (e.g., 'AVID buyer signed', 'TDS received')."),
      action: z.enum(["mark_signed", "mark_received", "mark_complete"]).optional()
        .describe("What to do with the items. Defaults to mark_signed."),
    },
    async ({ address, items, action }) => {
      try {
        const actionText = action === "mark_received" ? "received"
          : action === "mark_complete" ? "completed"
          : "signed";

        const result = await gasProxy({
          action: "voice",
          text: `Mark ${items} as ${actionText} on ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        return {
          content: [{
            type: "text",
            text: `✅ Checklist Update: ${address}\n\n${data.response || "Update processed."}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error updating checklist: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── get_daily_briefing ─────────────────────────────────────
  server.tool(
    "get_daily_briefing",
    "Get a daily briefing of all transactions that need attention — closings this week, overdue items, pending disclosures, urgent emails. The TC's morning dashboard.",
    {},
    async () => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: "give me my morning briefing",
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        return {
          content: [{
            type: "text",
            text: `☀️ Daily Briefing\n\n${data.response || "No briefing data available."}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error fetching briefing: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── list_escrows_by_date ──────────────────────────────────
  // Session 57 — Maps to LIST_BY_ACCEPTANCE voice command
  server.tool(
    "list_escrows_by_date",
    "List escrows that opened (were accepted) within a time range. Use when the user asks 'what escrows opened this week', 'new files this month', 'what came in today', etc. Returns addresses with acceptance dates.",
    {
      range: z.enum(["today", "this_week", "last_week", "this_month", "last_month"]).optional()
        .describe("Time range to filter by acceptance/contract date. Defaults to this_week."),
    },
    async ({ range }) => {
      try {
        const rangeMap = {
          today: "today",
          this_week: "this week",
          last_week: "last week",
          this_month: "this month",
          last_month: "last month",
        };
        const spoken = rangeMap[range] || "this week";

        const result = await gasProxy({
          action: "voice",
          text: `what escrows opened ${spoken}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        return {
          content: [{
            type: "text",
            text: `📂 Escrows Opened (${spoken})\n\n${data.response || "No data available."}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error listing escrows: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── query_transactions ────────────────────────────────────
  // Session 57 — General-purpose natural language query tool
  // Lets Claude ask ANY question about transactions and get
  // answers from the GAS backend (Gemini + sheet data).
  server.tool(
    "query_transactions",
    "Ask any natural language question about transactions, escrows, or sheet data. This is a flexible tool — use it when no other specific tool fits. Examples: 'which files are closing next week', 'who is the loan officer on Main Street', 'how many buyer side files do we have', 'what is the purchase price on the Smith property'. Routes through the GAS voice pipeline which has access to all Active Transactions sheet data.",
    {
      question: z.string().describe("The natural language question to ask about transactions (e.g., 'which files close next week', 'what is the price on Elm Street')."),
    },
    async ({ question }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: question,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `💬 Query Result\n\n${data.response || "No answer available."}\n`;

        // Include any structured data returned
        if (data.data && Object.keys(data.data).length > 0) {
          response += `\n---\nStructured data:\n${JSON.stringify(data.data, null, 2)}`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error querying: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}

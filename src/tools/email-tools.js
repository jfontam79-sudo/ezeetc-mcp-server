/**
 * ============================================================
 * Email Tools — MCP tool definitions for email intelligence
 * ============================================================
 * Maps to existing GAS actions:
 *   - EMAIL_SUMMARY (catch me up on emails)
 *   - EMAIL_DETAIL (tell me about number X)
 *   - VOICE_REPLY (draft a reply)
 *   - SEND_DRAFT (send drafted email)
 * ============================================================
 */

import { z } from "zod";

export function registerEmailTools(server, gasProxy) {

  // ── get_email_summary ──────────────────────────────────────
  server.tool(
    "get_email_summary",
    "Fetch a prioritized summary of recent emails, grouped by transaction. Returns numbered cards with urgency levels, sender names, Gemini AI summaries, and action-needed flags. Use this when the user asks to catch up on emails or wants to know what needs attention.",
    {
      timeframe: z.enum(["today", "recent", "this_week"]).optional()
        .describe("Time window for emails. Defaults to recent (last 24-48 hours)."),
    },
    async ({ timeframe }) => {
      try {
        // The GAS backend handles timeframe internally based on Gemini classification
        const queryText = timeframe === "this_week"
          ? "catch me up on this week's emails"
          : "catch me up on emails";

        const result = await gasProxy({
          action: "voice",
          text: queryText,
          context: "{}",
        });

        // Extract structured data if available
        const data = typeof result === "string" ? JSON.parse(result) : result;
        const numbered = data.data?.numbered || [];
        const count = data.data?.count || 0;

        // Format as a clean response for Claude
        let summary = `📧 Email Summary: ${count} emails across ${numbered.length} groups\n\n`;

        if (numbered.length > 0) {
          numbered.forEach((item) => {
            const urgency = (item.priority || "low").toUpperCase();
            const addr = item.txAddress || item.addr || "(non-transaction)";
            const senders = item.senders ? item.senders.join(", ") : "Unknown";
            summary += `${item.number}. [${urgency}] ${addr}\n`;
            summary += `   From: ${senders}`;
            if (item.emailCount > 1) summary += ` (${item.emailCount} emails)`;
            summary += "\n";
            if (item.summary) summary += `   Summary: ${item.summary}\n`;
            if (item.actionNeeded) summary += `   Action: ${item.actionNeeded}\n`;
            summary += "\n";
          });
        }

        return {
          content: [
            { type: "text", text: summary },
            // Include raw structured data so Claude can reference specifics
            { type: "text", text: `\n---\nStructured data:\n${JSON.stringify({ count, numbered }, null, 2)}` },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error fetching email summary: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── get_email_detail ───────────────────────────────────────
  server.tool(
    "get_email_detail",
    "Drill into a specific email group by number or transaction address. Returns detailed thread information, sender analysis, and recommended actions. Use after get_email_summary when the user wants details on a specific item.",
    {
      number: z.number().optional()
        .describe("The email group number (1-based) from the summary."),
      address: z.string().optional()
        .describe("The transaction address to look up emails for."),
    },
    async ({ number, address }) => {
      try {
        let queryText;
        if (number) {
          queryText = `tell me about number ${number}`;
        } else if (address) {
          queryText = `tell me more about the emails on ${address}`;
        } else {
          return {
            content: [{ type: "text", text: "Please provide either a number or address to look up." }],
            isError: true,
          };
        }

        const result = await gasProxy({
          action: "voice",
          text: queryText,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let detail = `📩 Email Detail\n\n`;
        detail += `${data.response || "No details available."}\n`;

        if (data.data) {
          if (data.data.address) detail += `\nTransaction: ${data.data.address}`;
          if (data.data.lastSender) detail += `\nLast sender: ${data.data.lastSender}`;
          if (data.data.threadMessageCount) detail += `\nThread messages: ${data.data.threadMessageCount}`;
          if (data.data.senderTone) detail += `\nSender tone: ${data.data.senderTone}`;
        }

        return {
          content: [
            { type: "text", text: detail },
            { type: "text", text: `\n---\nRaw data:\n${JSON.stringify(data.data || {}, null, 2)}` },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error fetching email detail: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── draft_reply ────────────────────────────────────────────
  server.tool(
    "draft_reply",
    "Draft an email reply for a specific transaction. EZee uses Gemini to compose a professional TC reply based on the user's instructions. The draft is saved to Gmail but NOT sent until explicitly confirmed.",
    {
      address: z.string().describe("The transaction address to reply about."),
      instructions: z.string().describe("What the user wants to say in the reply (natural language instructions)."),
    },
    async ({ address, instructions }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `Reply to the email on ${address} and say ${instructions}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        return {
          content: [{
            type: "text",
            text: `✉️ Draft Reply\n\n${data.response || "Draft created."}\n\nAction: ${data.action || "UNKNOWN"}\n${data.data?.status === "drafted" ? "⚠️ Draft is saved but NOT sent. User must say 'send it' to send." : ""}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error drafting reply: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── send_draft ─────────────────────────────────────────────
  server.tool(
    "send_draft",
    "Send a previously drafted email reply. Only call this after draft_reply and with explicit user confirmation. This action is irreversible.",
    {
      address: z.string().describe("The transaction address the draft was created for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `send it`,
          context: JSON.stringify({ pendingDraft: true, pendingDraftAddr: address }),
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        return {
          content: [{
            type: "text",
            text: `${data.data?.status === "sent" ? "✅ Email sent!" : "📧"} ${data.response || ""}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error sending draft: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}

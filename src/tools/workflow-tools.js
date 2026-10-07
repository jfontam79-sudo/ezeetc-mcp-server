/**
 * ============================================================
 * TC Workflow Tools — MCP tool definitions for template emails
 * and automation workflows every TC runs on every transaction
 * ============================================================
 * Maps to GAS voice commands built in Sessions 141-142:
 *   - OPEN_ESCROW (draft escrow opening package)
 *   - REQUEST_WIRE (draft wire instruction request)
 *   - SEND_WELCOME (draft agent welcome email)
 *   - FOLLOW_UP_LENDER (draft lender follow-up)
 *   - DRAFT_EMAIL (general-purpose email with CC)
 *   - RECOVER_MISSED_EMAIL (find and re-process missed emails)
 *   - ADD_BUYER_EMAIL (add buyer email to transaction)
 *
 * Session 142 — 2026-10-01
 * ============================================================
 */

import { z } from "zod";

export function registerWorkflowTools(server, gasProxy) {

  // ── open_escrow ───────────────────────────────────────────
  server.tool(
    "open_escrow",
    "Draft an escrow opening package email to the escrow officer. Includes a formatted HTML email with transaction details, buyer information, seller information, and all data needed to open escrow. Creates a Gmail draft that the user can review before sending.",
    {
      address: z.string().describe("The property address to open escrow for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `open escrow for ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `🏢 Open Escrow: ${address}\n\n`;
        response += `${data.response || "Processing..."}\n`;

        if (data.action === "DRAFT_CREATED") {
          response += `\n✅ Draft created in Gmail — ready for review and sending`;
        }

        if (data.data) {
          response += `\n\n---\nTransaction Summary:\n${JSON.stringify(data.data, null, 2)}`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error drafting escrow opening: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── request_wire ──────────────────────────────────────────
  server.tool(
    "request_wire",
    "Draft an email to the escrow officer requesting wire instructions. Asks for bank name, ABA/routing number, account number, reference number, and wire amount. Creates a Gmail draft for review.",
    {
      address: z.string().describe("The property address to request wire instructions for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `request wire instructions for ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `💸 Wire Instructions Request: ${address}\n\n`;
        response += `${data.response || "Processing..."}\n`;

        if (data.action === "DRAFT_CREATED") {
          response += `\n✅ Draft created in Gmail — ready for review and sending`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error drafting wire request: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── send_welcome ──────────────────────────────────────────
  server.tool(
    "send_welcome",
    "Draft a branded welcome email introducing EZeeTC as the transaction coordinator to both the buyer's agent and listing agent. Includes transaction summary and TC services outline. Creates a Gmail draft for review.",
    {
      address: z.string().describe("The property address to send the welcome for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `send welcome email for ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `👋 Welcome Email: ${address}\n\n`;
        response += `${data.response || "Processing..."}\n`;

        if (data.action === "DRAFT_CREATED") {
          response += `\n✅ Draft created in Gmail — ready for review and sending`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error drafting welcome email: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── follow_up_lender ──────────────────────────────────────
  server.tool(
    "follow_up_lender",
    "Draft a lender follow-up email requesting loan status, appraisal update, and clear-to-close estimate. Smart lender lookup: checks stored contacts first, then scans Gmail history to find the loan officer. Creates a Gmail draft for review.",
    {
      address: z.string().describe("The property address to follow up on."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `follow up with lender on ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `🏦 Lender Follow-Up: ${address}\n\n`;
        response += `${data.response || "Processing..."}\n`;

        if (data.action === "DRAFT_CREATED") {
          response += `\n✅ Draft created in Gmail — ready for review and sending`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error drafting lender follow-up: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── draft_email ───────────────────────────────────────────
  server.tool(
    "draft_email",
    "Draft an email to anyone about any transaction topic. Uses 3-layer contact resolution: (1) Active Transactions role lookup, (2) stored contacts by name, (3) Gmail history search. Supports CC recipients. AI-composed professional email body based on context. Creates a Gmail draft for review.",
    {
      address: z.string().describe("The property address for context."),
      recipient: z.string().describe("Who to email — a role ('buyer agent', 'escrow officer'), a name ('Abbey Taylor'), or an email address."),
      topic: z.string().describe("What the email should be about (e.g., 'inspection reschedule', 'closing date change', 'appraisal received')."),
      cc: z.string().optional()
        .describe("Optional CC recipients — comma-separated roles, names, or emails (e.g., 'listing agent, Abbey Taylor')."),
    },
    async ({ address, recipient, topic, cc }) => {
      try {
        let queryText = `email ${recipient} about ${topic} on ${address}`;
        if (cc) queryText += ` CC ${cc}`;

        const result = await gasProxy({
          action: "voice",
          text: queryText,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `✉️ Email Draft: ${address}\n\n`;
        response += `To: ${recipient}\n`;
        if (cc) response += `CC: ${cc}\n`;
        response += `Topic: ${topic}\n\n`;
        response += `${data.response || "Processing..."}\n`;

        if (data.action === "DRAFT_CREATED") {
          response += `\n✅ Draft created in Gmail — ready for review and sending`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error drafting email: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── recover_missed_email ──────────────────────────────────
  server.tool(
    "recover_missed_email",
    "Search Gmail for emails that may have been missed by the automated intake system. Finds recent emails matching a transaction address and offers to re-process them through the contract intake pipeline. Useful when an email wasn't auto-detected.",
    {
      address: z.string().describe("The property address to search for missed emails."),
      searchTerms: z.string().optional()
        .describe("Additional search terms to narrow the Gmail search (e.g., sender name, subject keywords)."),
    },
    async ({ address, searchTerms }) => {
      try {
        let queryText = `recover missed email for ${address}`;
        if (searchTerms) queryText += ` about ${searchTerms}`;

        const result = await gasProxy({
          action: "voice",
          text: queryText,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `🔍 Email Recovery: ${address}\n\n`;
        response += `${data.response || "Searching..."}\n`;

        if (data.data?.emailsFound) {
          response += `\nFound ${data.data.emailsFound} matching emails`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error recovering emails: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── add_buyer_email ───────────────────────────────────────
  server.tool(
    "add_buyer_email",
    "Add or update the buyer's email address on a transaction. This is required before sending disclosures via DocuSign. Supports both single and dual-buyer transactions.",
    {
      address: z.string().describe("The property address."),
      buyerEmail: z.string().describe("The buyer's email address."),
      buyer2Email: z.string().optional()
        .describe("Second buyer's email (for dual-buyer transactions)."),
    },
    async ({ address, buyerEmail, buyer2Email }) => {
      try {
        let queryText = `add buyer email ${buyerEmail} on ${address}`;
        if (buyer2Email) queryText += ` and buyer 2 email ${buyer2Email}`;

        const result = await gasProxy({
          action: "voice",
          text: queryText,
          context: JSON.stringify({ buyerEmail, buyer2Email }),
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `📧 Buyer Email Updated: ${address}\n\n`;
        response += `${data.response || "Email added."}\n`;
        response += `\nBuyer 1: ${buyerEmail}`;
        if (buyer2Email) response += `\nBuyer 2: ${buyer2Email}`;

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error adding buyer email: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── send_pending_draft ────────────────────────────────────
  server.tool(
    "send_pending_draft",
    "Send a previously drafted email that's waiting in Gmail drafts. Use this after any draft_email, open_escrow, request_wire, send_welcome, or follow_up_lender tool when the user confirms they want to send. This action is irreversible — the email will be sent.",
    {
      address: z.string().describe("The property address the draft was created for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: "send it",
          context: JSON.stringify({ pendingDraft: true, pendingDraftAddr: address }),
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        const sent = data.action === "EMAIL_SENT" || data.data?.status === "sent";

        return {
          content: [{
            type: "text",
            text: `${sent ? "✅ Email sent!" : "📧"} ${data.response || ""}`,
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

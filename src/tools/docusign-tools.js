/**
 * ============================================================
 * DocuSign Tools — MCP tool definitions for DocuSign automation
 * ============================================================
 * Maps to existing GAS voice commands:
 *   - SEND_DISCLOSURES (buyer disclosure package via DocuSign)
 *   - SEND_PURCHASE_CONTRACT (RPA via DocuSign templates)
 *   - SEND_COUNTER_OFFER (SCO/BCO/SMCO via DocuSign)
 *   - SEND_ADDENDUM (ADM via DocuSign)
 *   - CHECK_ENVELOPE_STATUS
 *
 * All DocuSign operations require explicit user confirmation
 * before execution — they send real legal documents.
 *
 * Session 142 — 2026-10-01
 * ============================================================
 */

import { z } from "zod";

export function registerDocuSignTools(server, gasProxy) {

  // ── send_disclosures ──────────────────────────────────────
  server.tool(
    "send_disclosures",
    "Send buyer disclosure package via DocuSign for a specific transaction. Automatically finds disclosure PDFs in Google Drive, builds the envelope with proper anchor-based tab placement, and routes for signing. IMPORTANT: Requires buyer email(s) on file. Always confirm with the user before sending — this sends real legal documents.",
    {
      address: z.string().describe("The property address to send disclosures for."),
      buyerEmail: z.string().optional()
        .describe("Optional buyer email if not already on file."),
      buyer2Email: z.string().optional()
        .describe("Optional second buyer email for dual-buyer transactions."),
    },
    async ({ address, buyerEmail, buyer2Email }) => {
      try {
        let queryText = `send disclosures for ${address}`;
        if (buyerEmail) queryText += ` to ${buyerEmail}`;

        const context = {};
        if (buyerEmail) context.buyerEmail = buyerEmail;
        if (buyer2Email) context.buyer2Email = buyer2Email;

        const result = await gasProxy({
          action: "voice",
          text: queryText,
          context: JSON.stringify(context),
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `📄 DocuSign Disclosures: ${address}\n\n`;
        response += `${data.response || "Processing..."}\n`;

        if (data.action === "DOCUSIGN_SENT") {
          response += `\n✅ Envelope sent successfully`;
          if (data.data?.envelopeId) response += `\nEnvelope ID: ${data.data.envelopeId}`;
        } else if (data.action === "PENDING_APPROVAL") {
          response += `\n⚠️ Awaiting approval before sending`;
        } else if (data.action === "NEED_BUYER_EMAIL") {
          response += `\n❌ Buyer email required — please provide the buyer's email address`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error sending disclosures: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── send_purchase_contract ────────────────────────────────
  server.tool(
    "send_purchase_contract",
    "Send a California Residential Purchase Agreement (RPA) via DocuSign. Uses pre-configured templates with all standard fields auto-populated from transaction data. Supports the full conversational RPA wizard for collecting missing fields. Always confirm with the user before sending.",
    {
      address: z.string().describe("The property address for the purchase contract."),
      buyerName: z.string().optional().describe("Buyer's full legal name."),
      sellerName: z.string().optional().describe("Seller's full legal name."),
      purchasePrice: z.string().optional().describe("Purchase price (e.g., '750000')."),
      closeOfEscrow: z.string().optional().describe("Close of escrow date (MM/DD/YYYY)."),
    },
    async ({ address, buyerName, sellerName, purchasePrice, closeOfEscrow }) => {
      try {
        let queryText = `send purchase contract for ${address}`;

        const context = {};
        if (buyerName) context.buyerName = buyerName;
        if (sellerName) context.sellerName = sellerName;
        if (purchasePrice) context.purchasePrice = purchasePrice;
        if (closeOfEscrow) context.closeOfEscrow = closeOfEscrow;

        const result = await gasProxy({
          action: "voice",
          text: queryText,
          context: JSON.stringify(context),
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `📝 Purchase Contract (RPA): ${address}\n\n`;
        response += `${data.response || "Processing..."}\n`;

        if (data.action === "DOCUSIGN_SENT") {
          response += `\n✅ RPA envelope sent`;
          if (data.data?.envelopeId) response += `\nEnvelope ID: ${data.data.envelopeId}`;
        } else if (data.action === "RPA_CONVERSATION") {
          response += `\n💬 Additional information needed — the RPA wizard is collecting missing fields`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error sending purchase contract: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── send_counter_offer ────────────────────────────────────
  server.tool(
    "send_counter_offer",
    "Send a counter offer (SCO — Seller Counter Offer, BCO — Buyer Counter Offer, or SMCO — Seller Multiple Counter Offer) via DocuSign for a specific transaction. Automatically uses anchor-based tab placement on the correct form.",
    {
      address: z.string().describe("The property address."),
      formType: z.enum(["SCO", "BCO", "SMCO"])
        .describe("The counter offer form type: SCO (seller counter), BCO (buyer counter), SMCO (seller multiple counter)."),
    },
    async ({ address, formType }) => {
      try {
        const formNames = {
          SCO: "seller counter offer",
          BCO: "buyer counter offer",
          SMCO: "seller multiple counter offer",
        };

        const result = await gasProxy({
          action: "voice",
          text: `send ${formNames[formType]} for ${address}`,
          context: JSON.stringify({ formType }),
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `📋 Counter Offer (${formType}): ${address}\n\n`;
        response += `${data.response || "Processing..."}\n`;

        if (data.action === "DOCUSIGN_SENT") {
          response += `\n✅ ${formType} envelope sent`;
          if (data.data?.envelopeId) response += `\nEnvelope ID: ${data.data.envelopeId}`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error sending counter offer: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── send_addendum ─────────────────────────────────────────
  server.tool(
    "send_addendum",
    "Send an addendum (ADM) via DocuSign for a specific transaction. The addendum is auto-detected from Google Drive or can reference a specific document.",
    {
      address: z.string().describe("The property address."),
      description: z.string().optional()
        .describe("Brief description of the addendum purpose (e.g., 'extend closing date', 'repair credit')."),
    },
    async ({ address, description }) => {
      try {
        let queryText = `send addendum for ${address}`;
        if (description) queryText += ` regarding ${description}`;

        const result = await gasProxy({
          action: "voice",
          text: queryText,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `📎 Addendum: ${address}\n\n`;
        response += `${data.response || "Processing..."}\n`;

        if (data.action === "DOCUSIGN_SENT") {
          response += `\n✅ Addendum envelope sent`;
          if (data.data?.envelopeId) response += `\nEnvelope ID: ${data.data.envelopeId}`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error sending addendum: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── check_envelope_status ─────────────────────────────────
  server.tool(
    "check_envelope_status",
    "Check the status of DocuSign envelopes for a transaction — who has signed, who hasn't, when it was sent, and whether it's completed. Use when the user asks about signing status.",
    {
      address: z.string().describe("The property address to check DocuSign status for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `What is the DocuSign status on ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `✍️ DocuSign Status: ${address}\n\n`;
        response += `${data.response || "No DocuSign data available."}\n`;

        if (data.data?.envelopes) {
          data.data.envelopes.forEach((env, i) => {
            response += `\n${i + 1}. ${env.type || "Document"} — ${env.status || "Unknown"}`;
            if (env.sentDate) response += ` (sent ${env.sentDate})`;
            if (env.completedDate) response += ` (completed ${env.completedDate})`;
          });
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error checking DocuSign status: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── send_escrow_instructions ──────────────────────────────
  server.tool(
    "send_escrow_instructions",
    "Send escrow instructions via DocuSign for signing by buyer and seller. Auto-detects the escrow instruction PDF from Google Drive and places signature tabs using anchor-based mapping.",
    {
      address: z.string().describe("The property address."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `send escrow instructions for ${address} via DocuSign`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let response = `📜 Escrow Instructions: ${address}\n\n`;
        response += `${data.response || "Processing..."}\n`;

        if (data.action === "DOCUSIGN_SENT") {
          response += `\n✅ Escrow instructions sent for signing`;
          if (data.data?.envelopeId) response += `\nEnvelope ID: ${data.data.envelopeId}`;
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error sending escrow instructions: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}

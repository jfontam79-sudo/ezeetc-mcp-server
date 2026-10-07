/**
 * ============================================================
 * Contact/Vendor Tools — MCP tool definitions for contact lookup
 * ============================================================
 * Maps to existing GAS actions:
 *   - LOAN_OFFICER_LOOKUP
 *   - FIND_LOAN_PROCESSOR
 *   - FIND_ESCROW_OFFICER (via ESCROW_OFFICER_LOOKUP)
 *   - CONTACT_SUMMARY
 *   - CONTACTS_REFRESHED
 * ============================================================
 */

import { z } from "zod";

export function registerContactTools(server, gasProxy) {

  // ── find_loan_officer ──────────────────────────────────────
  server.tool(
    "find_loan_officer",
    "Find the loan officer for a specific transaction. Checks cache first (Pinecone + sheet), then scans Gmail threads if not found. Returns name, company, email, and phone when available.",
    {
      address: z.string().describe("The property address to find the loan officer for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `Who is the loan officer on ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let info = `🏦 Loan Officer Lookup: ${address}\n\n`;
        info += `${data.response || "No loan officer found."}\n`;

        if (data.data) {
          const d = data.data;
          if (d.contactName) info += `\nName: ${d.contactName}`;
          if (d.company) info += `\nCompany: ${d.company}`;
          if (d.email) info += `\nEmail: ${d.email}`;
          if (d.phone) info += `\nPhone: ${d.phone}`;
          if (d.source) info += `\nSource: ${d.source}`;
        }

        return {
          content: [{ type: "text", text: info }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error finding loan officer: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── find_loan_processor ────────────────────────────────────
  server.tool(
    "find_loan_processor",
    "Find the loan processor for a specific transaction. Uses self-ID scoring against Gmail threads — looks for people who identify as 'the processor on this file'. Returns name, company, and contact info.",
    {
      address: z.string().describe("The property address to find the loan processor for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `Who is the loan processor on ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let info = `📋 Loan Processor Lookup: ${address}\n\n`;
        info += `${data.response || "No loan processor found."}\n`;

        if (data.data) {
          const d = data.data;
          if (d.contactName) info += `\nName: ${d.contactName}`;
          if (d.company) info += `\nCompany: ${d.company}`;
          if (d.email) info += `\nEmail: ${d.email}`;
          if (d.phone) info += `\nPhone: ${d.phone}`;
        }

        return {
          content: [{ type: "text", text: info }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error finding loan processor: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── find_escrow_officer ────────────────────────────────────
  server.tool(
    "find_escrow_officer",
    "Find the escrow officer for a specific transaction. Checks cache, then parses Gmail thread signatures for escrow company and officer names.",
    {
      address: z.string().describe("The property address to find the escrow officer for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `Who is the escrow officer on ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        let info = `🔐 Escrow Officer Lookup: ${address}\n\n`;
        info += `${data.response || "No escrow officer found."}\n`;

        if (data.data) {
          const d = data.data;
          if (d.contactName) info += `\nName: ${d.contactName}`;
          if (d.company) info += `\nCompany: ${d.company}`;
          if (d.email) info += `\nEmail: ${d.email}`;
          if (d.phone) info += `\nPhone: ${d.phone}`;
        }

        return {
          content: [{ type: "text", text: info }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error finding escrow officer: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── get_contact_info ───────────────────────────────────────
  server.tool(
    "get_contact_info",
    "Look up a specific person's contact information from the Pinecone roster. Returns name, role, company, email, phone, and any notes.",
    {
      name: z.string().describe("The person's name to look up (e.g., 'Robert Winters', 'Ernie Gonzales')."),
    },
    async ({ name }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `Tell me about ${name}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        return {
          content: [{
            type: "text",
            text: `👤 Contact Info: ${name}\n\n${data.response || "No contact information found."}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error looking up contact: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── refresh_contacts ───────────────────────────────────────
  server.tool(
    "refresh_contacts",
    "Re-scan Gmail threads for a transaction to discover or update contact information. Useful when contacts may have changed or when initial discovery missed someone.",
    {
      address: z.string().describe("The property address to refresh contacts for."),
    },
    async ({ address }) => {
      try {
        const result = await gasProxy({
          action: "voice",
          text: `Refresh the contacts on ${address}`,
          context: "{}",
        });

        const data = typeof result === "string" ? JSON.parse(result) : result;

        return {
          content: [{
            type: "text",
            text: `🔄 Contact Refresh: ${address}\n\n${data.response || "Contacts refreshed."}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error refreshing contacts: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}

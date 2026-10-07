/**
 * ============================================================
 * MCP Prompts — Pre-built workflow templates for Claude
 * ============================================================
 * Prompts are reusable templates that guide Claude through
 * multi-step TC workflows. The user selects a prompt, Claude
 * fills in the arguments, and follows the template.
 *
 * Session 143 — 2026-10-02
 * ============================================================
 */

export function registerPrompts(server) {

  // ── Morning Briefing ─────────────────────────────────────
  server.prompt(
    "morning-briefing",
    "Start the day with a complete briefing — emails, closings this week, overdue items, and pending disclosures.",
    [],
    async () => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Run my complete morning briefing:

1. First, call get_daily_briefing to see what needs attention today
2. Then call get_email_summary to check for overnight emails
3. Finally, call list_active_transactions with filter "closing this week" to see upcoming closings

Summarize everything in a clean morning report: what's urgent, what's due today, and what I should focus on first.`
          },
        }],
      };
    }
  );

  // ── New File Setup ───────────────────────────────────────
  server.prompt(
    "new-file-setup",
    "Run the complete new transaction setup workflow — welcome email, escrow opening, lender contact, and checklist review.",
    [
      {
        name: "address",
        description: "The property address for the new transaction",
        required: true,
      },
    ],
    async ({ address }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Run the new file setup workflow for ${address}:

1. Call get_transaction_detail to pull the full file info
2. Call send_welcome to draft the agent introduction email
3. Call open_escrow to draft the escrow opening package
4. Call find_loan_officer to identify the lender contact
5. If a loan officer is found, call follow_up_lender to draft the initial lender status request

Show me what was drafted and what still needs my attention. Don't send anything yet — I want to review all drafts first.`
          },
        }],
      };
    }
  );

  // ── Closing Checklist Review ─────────────────────────────
  server.prompt(
    "closing-review",
    "Review everything needed before closing — outstanding items, unsigned docs, missing disclosures, and wire status.",
    [
      {
        name: "address",
        description: "The property address closing soon",
        required: true,
      },
    ],
    async ({ address }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Run a pre-closing review for ${address}:

1. Call get_transaction_detail to see the full file status
2. Call check_envelope_status to see who has and hasn't signed
3. Call get_transaction_timeline to verify all deadlines are met
4. Call get_email_detail with the address to check for any recent urgent emails

Give me a clear closing readiness report:
- ✅ What's done
- ⚠️ What's pending but on track
- ❌ What's missing or overdue
- 📋 Action items I need to handle today`
          },
        }],
      };
    }
  );

  // ── Weekly Status Report ─────────────────────────────────
  server.prompt(
    "weekly-status",
    "Generate a weekly status report across all active transactions — closings, new files, pipeline health.",
    [],
    async () => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Generate my weekly status report:

1. Call list_active_transactions to get the full dashboard
2. Call list_escrows_by_date with range "this_week" to see new files
3. Call list_active_transactions with filter "closing this week" for upcoming closings

Build a professional weekly summary with:
- Total active files and breakdown by type (buyer/seller side)
- Files closing this week (with any alerts)
- New files opened this week
- Any files with overdue items or red flags
- Quick stats: how many closings completed, pipeline health`
          },
        }],
      };
    }
  );

  // ── Disclosure Package ───────────────────────────────────
  server.prompt(
    "send-disclosure-package",
    "Send a complete buyer disclosure package via DocuSign — looks up buyer emails, finds PDFs, and sends.",
    [
      {
        name: "address",
        description: "The property address to send disclosures for",
        required: true,
      },
    ],
    async ({ address }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Send the disclosure package for ${address}:

1. Call get_transaction_detail to verify the file and get buyer info
2. Check if buyer email(s) are on file
3. If no buyer email, ask me for it and call add_buyer_email
4. Once buyer email is confirmed, call send_disclosures

Walk me through each step and confirm before sending — these are legal documents.`
          },
        }],
      };
    }
  );
}

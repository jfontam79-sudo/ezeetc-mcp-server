/**
 * ============================================================
 * Auth Module — Multi-tenant OAuth for EZeeTC MCP
 * ============================================================
 * Handles user authentication and tenant routing.
 *
 * Architecture:
 *   Phase 1 (Current): Bearer token auth — single-user mode
 *   Phase 2 (Marketplace): OAuth2 with Google Workspace
 *     - Each user authorizes their own Google account
 *     - Server stores their GAS web app URL + refresh token
 *     - Tool calls are routed to the correct tenant's GAS backend
 *
 * OAuth Flow (Phase 2):
 *   1. User installs EZeeTC plugin in Claude
 *   2. On first tool call, MCP server returns auth_required
 *   3. Claude redirects user to Google OAuth consent screen
 *   4. User grants access to Gmail, Drive, Sheets
 *   5. Server stores refresh token + user's GAS URL
 *   6. Subsequent calls include the tenant's bearer token
 *   7. Server routes to correct GAS backend
 *
 * Tenant Provisioning (Phase 2):
 *   1. New user signs up → template spreadsheet is cloned
 *   2. GAS project is bound to their copy
 *   3. Triggers are installed on their copy
 *   4. GAS web app URL is stored in tenant record
 *
 * Session 142 — 2026-10-01
 * ============================================================
 */

// ── Tenant Store (Phase 1: in-memory, Phase 2: database) ───
const tenants = new Map();

/**
 * Phase 1: Simple bearer token validation.
 * Phase 2: JWT validation → tenant lookup → GAS URL routing.
 */
export function validateToken(token) {
  if (!token) return null;

  // Phase 1: Static bearer token mode
  const staticToken = process.env.MCP_BEARER_TOKEN;
  if (staticToken && token === staticToken) {
    return {
      tenantId: "default",
      gasUrl: process.env.GAS_URL,
      email: process.env.TENANT_EMAIL || "pita@ezeetc.com",
    };
  }

  // Phase 2: Look up tenant by token
  const tenant = tenants.get(token);
  if (tenant) return tenant;

  return null;
}

/**
 * Register a new tenant (Phase 2).
 * Called after OAuth flow completes.
 */
export function registerTenant({ tenantId, email, gasUrl, refreshToken }) {
  const token = generateTenantToken(tenantId);

  tenants.set(token, {
    tenantId,
    email,
    gasUrl,
    refreshToken,
    createdAt: new Date().toISOString(),
  });

  return { token, tenantId };
}

/**
 * Generate a deterministic but unique tenant token.
 * Phase 2 will use proper JWT signing.
 */
function generateTenantToken(tenantId) {
  const crypto = await import("crypto");
  return crypto.createHash("sha256")
    .update(`${tenantId}:${Date.now()}:${process.env.TOKEN_SECRET || "ezeetc"}`)
    .digest("hex");
}

/**
 * OAuth2 Configuration for Google Workspace (Phase 2).
 * Scopes needed for EZeeTC to function:
 */
export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: process.env.OAUTH_REDIRECT_URI || "https://mcp.ezeetc.com/oauth/callback",
  scopes: [
    "https://www.googleapis.com/auth/gmail.modify",      // Read + draft + send emails
    "https://www.googleapis.com/auth/drive.readonly",     // Access disclosure PDFs
    "https://www.googleapis.com/auth/spreadsheets",       // Read/write transaction data
    "https://www.googleapis.com/auth/script.external_request", // GAS web app calls
    "openid",
    "email",
    "profile",
  ],
};

/**
 * Template Spreadsheet Configuration (Phase 2).
 * When a new user signs up, we clone this template
 * and set up their GAS project on the copy.
 */
export const TEMPLATE_CONFIG = {
  // Master template spreadsheet ID (will be created during buildout)
  templateSpreadsheetId: process.env.TEMPLATE_SPREADSHEET_ID || "",

  // Tabs that get created in each new user's spreadsheet
  requiredTabs: [
    "Active Transactions",
    "Active Listings",
    "Contacts",
    "System Flags",
    "Ideas Backlog",
    "Voice Alert Queue",
    "Disclosure Checklist",
  ],

  // Default columns for Active Transactions tab
  // (mirrors COLUMN_REGISTRY from 1_Config.js)
  columnHeaders: [
    "Purchase Price", "Address", "Buyer Name", "Seller Name",
    "Buyer Agent", "Buyer Broker", "Buyer Agent Email", "Buyer Agent Phone",
    "", "Listing Agent Name", "Listing Broker", "Listing Agent Email",
    "Listing Agent Phone", "Contract Date", "Inspection Date",
    "Appraisal Date", "Loan Date", "Closing Date", "Escrow Officer",
    "Escrow Officer Name", "Escrow Officer Email", "Escrow Officer Phone",
    "Platform", "Platform ID", "Representing Side", "TC Fee",
    "CDA Sent", "CDA Sent Date", "Closed Date", "Invoice Sent",
    "Disclosures Sent", "Seller Email", "Buyer Email",
    "Intake Status", "Disclosure Status", "Disclosures", "DocuSign",
    "Thread IDs", "Last Activity", "Last Activity Date", "Notes"
  ],
};

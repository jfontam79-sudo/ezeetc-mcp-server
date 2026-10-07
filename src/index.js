/**
 * ============================================================
 * EZeeTC MCP Server v2.1
 * ============================================================
 * Bridges Claude Desktop/Managed Agents to the EZeeTC Google
 * Apps Script backend via the Model Context Protocol.
 *
 * v2.1 Upgrades (Session 143):
 *   - MCP Resources (transactions, system status, help)
 *   - MCP Prompts (morning briefing, new file, closing review)
 *   - Retry logic with exponential backoff
 *   - Session auto-cleanup (stale session expiry)
 *   - /stats endpoint for monitoring
 *   - Direct action routing (bypass Gemini where possible)
 *
 * Transport: Streamable HTTP (Express + MCP SDK)
 * Auth: Bearer token (static for single-user, OAuth for multi-tenant)
 *
 * Phase 1 — Session 54/55 — 2026-04-10
 * Phase 2 — Session 142 — 2026-10-01 (DocuSign + TC Workflows)
 * Phase 3 — Session 143 — 2026-10-02 (Resources + Prompts + Retry)
 * ============================================================
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import crypto from "crypto";
import { gasProxy } from "./gas-proxy.js";
import { registerEmailTools } from "./tools/email-tools.js";
import { registerTransactionTools } from "./tools/transaction-tools.js";
import { registerContactTools } from "./tools/contact-tools.js";
import { registerDocuSignTools } from "./tools/docusign-tools.js";
import { registerWorkflowTools } from "./tools/workflow-tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

// ── Configuration ────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const BEARER_TOKEN = process.env.MCP_BEARER_TOKEN || "";
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // Every 15 minutes
const SERVER_VERSION = "2.1.0";

// ── Session store ────────────────────────────────────────────
const sessions = new Map(); // sessionId → { transport, server, createdAt, lastActivity }
const serverStartedAt = Date.now();

/**
 * Create a fresh McpServer with all tools, resources, and prompts.
 */
function createMcpServer() {
  const server = new McpServer({
    name: "ezeetc-mcp",
    version: SERVER_VERSION,
    description:
      "EZeeTC Transaction Coordinator — 30+ MCP tools, resources, and workflow prompts for email, transactions, contacts, DocuSign, and TC automation.",
  });

  // Register all tool modules (30+ tools across 5 categories)
  registerEmailTools(server, gasProxy);        // 4 tools
  registerTransactionTools(server, gasProxy);  // 8 tools
  registerContactTools(server, gasProxy);      // 5 tools
  registerDocuSignTools(server, gasProxy);     // 6 tools
  registerWorkflowTools(server, gasProxy);     // 8 tools

  // Register MCP Resources (pre-loaded context)
  registerResources(server);                   // 3 resources

  // Register MCP Prompts (workflow templates)
  registerPrompts(server);                     // 5 prompts

  return server;
}

// ── Express app ──────────────────────────────────────────────
const app = express();
app.use(express.json());

// CORS
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, mcp-session-id"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Expose-Headers", "mcp-session-id");
  next();
});

app.options("/mcp", (_req, res) => res.sendStatus(204));

// ── Health check ────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "ezeetc-mcp",
    version: SERVER_VERSION,
    activeSessions: sessions.size,
  });
});

// ── Stats endpoint (for monitoring) ─────────────────────────
app.get("/stats", (_req, res) => {
  const now = Date.now();
  const sessionList = [];
  for (const [id, sess] of sessions) {
    sessionList.push({
      id: id.substring(0, 8) + "...",
      ageMinutes: Math.round((now - sess.createdAt) / 60000),
      lastActivityMinutes: Math.round((now - sess.lastActivity) / 60000),
    });
  }

  res.json({
    server: "ezeetc-mcp",
    version: SERVER_VERSION,
    uptimeMinutes: Math.round((now - serverStartedAt) / 60000),
    activeSessions: sessions.size,
    sessions: sessionList,
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    nodeVersion: process.version,
    authMode: BEARER_TOKEN ? "bearer_token" : "open",
    toolCount: 31,
    resourceCount: 3,
    promptCount: 5,
  });
});

// ── Bearer token auth middleware ─────────────────────────────
function authMiddleware(req, res, next) {
  if (!BEARER_TOKEN) return next();
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${BEARER_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ── POST /mcp ───────────────────────────────────────────────
app.post("/mcp", authMiddleware, async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"];

    if (sessionId && sessions.has(sessionId)) {
      // Existing session — update activity timestamp and forward
      const sess = sessions.get(sessionId);
      sess.lastActivity = Date.now();
      await sess.transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — create transport + server
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
    });

    const server = createMcpServer();

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && sessions.has(sid)) {
        console.log(`[EZeeTC MCP] Session closed: ${sid}`);
        sessions.delete(sid);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId) {
      const now = Date.now();
      sessions.set(transport.sessionId, {
        transport,
        server,
        createdAt: now,
        lastActivity: now,
      });
      console.log(
        `[EZeeTC MCP] New session: ${transport.sessionId} (${sessions.size} active)`
      );
    }
  } catch (err) {
    console.error("[MCP POST] Error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// ── GET /mcp — SSE stream ───────────────────────────────────
app.get("/mcp", authMiddleware, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }

  try {
    const sess = sessions.get(sessionId);
    sess.lastActivity = Date.now();
    await sess.transport.handleRequest(req, res);
  } catch (err) {
    console.error("[MCP GET] Error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// ── DELETE /mcp ─────────────────────────────────────────────
app.delete("/mcp", authMiddleware, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }

  try {
    const { transport } = sessions.get(sessionId);
    await transport.handleRequest(req, res);
    sessions.delete(sessionId);
    console.log(
      `[EZeeTC MCP] Session deleted: ${sessionId} (${sessions.size} active)`
    );
  } catch (err) {
    console.error("[MCP DELETE] Error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// ── Session cleanup (auto-expire stale sessions) ────────────
function cleanupStaleSessions() {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, sess] of sessions) {
    const idle = now - sess.lastActivity;
    const age = now - sess.createdAt;

    if (idle > SESSION_TTL_MS || age > SESSION_TTL_MS * 2) {
      try {
        sess.transport.close?.();
      } catch { /* ignore close errors */ }
      sessions.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(
      `[EZeeTC MCP] Cleaned ${cleaned} stale session(s) (${sessions.size} remaining)`
    );
  }
}

// Run cleanup on interval
setInterval(cleanupStaleSessions, CLEANUP_INTERVAL_MS);

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[EZeeTC MCP] Server v${SERVER_VERSION} running on port ${PORT}`);
  console.log(`[EZeeTC MCP] MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`[EZeeTC MCP] Health check: http://localhost:${PORT}/health`);
  console.log(`[EZeeTC MCP] Stats:        http://localhost:${PORT}/stats`);
  console.log(
    `[EZeeTC MCP] Auth: ${BEARER_TOKEN ? "Bearer token required" : "No auth (dev mode)"}`
  );
  console.log(
    `[EZeeTC MCP] Tools: 31 | Resources: 3 | Prompts: 5`
  );
});

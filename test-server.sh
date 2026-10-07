#!/bin/bash
# ============================================================
# EZeeTC MCP Server — Quick Test Script
# ============================================================
# Run this after `npm install && npm start` to verify the
# server is working. Tests health check, MCP initialize,
# tool list, and a live email summary call.
#
# Usage: bash test-server.sh [port]
# Default port: 3001
# ============================================================

PORT=${1:-3001}
BASE="http://localhost:${PORT}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================"
echo " EZeeTC MCP Server Test Suite"
echo " Testing: ${BASE}"
echo "============================================"
echo ""

# ── Test 1: Health check ─────────────────────────────────────
echo -n "1. Health check... "
HEALTH=$(curl -s "${BASE}/health")
if echo "$HEALTH" | grep -q '"ok"'; then
  echo -e "${GREEN}PASS${NC} — $HEALTH"
else
  echo -e "${RED}FAIL${NC} — Server not responding"
  echo "   Make sure the server is running: npm start"
  exit 1
fi
echo ""

# ── Test 2: MCP Initialize (creates session) ─────────────────
echo -n "2. MCP Initialize... "
INIT_RESPONSE=$(curl -s -i -X POST "${BASE}/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "ezeetc-test", "version": "1.0.0" }
    }
  }' 2>/dev/null)

# Extract session ID from response headers (case-insensitive)
SESSION_ID=$(echo "$INIT_RESPONSE" | grep -i '^mcp-session-id:' | tr -d '\r' | awk '{print $2}')

# Extract JSON body (everything after the blank line separating headers from body)
INIT_BODY=$(echo "$INIT_RESPONSE" | sed -n '/^\r*$/,$p' | tail -n +2)

if [ -n "$SESSION_ID" ]; then
  echo -e "${GREEN}PASS${NC} — Session: ${SESSION_ID:0:12}..."
else
  echo -e "${YELLOW}WARN${NC} — No session ID in response headers"
  echo "   Headers:"
  echo "$INIT_RESPONSE" | head -15
fi

# Check if initialize returned server info
if echo "$INIT_BODY" | grep -q '"serverInfo"'; then
  echo "   Server info found in response"
else
  echo "   Response body: ${INIT_BODY:0:200}"
fi
echo ""

# ── Send initialized notification (required by MCP protocol) ──
if [ -n "$SESSION_ID" ]; then
  curl -s -X POST "${BASE}/mcp" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "mcp-session-id: ${SESSION_ID}" \
    -d '{
      "jsonrpc": "2.0",
      "method": "notifications/initialized"
    }' > /dev/null 2>&1
fi

# ── Test 3: List tools ────────────────────────────────────────
if [ -n "$SESSION_ID" ]; then
  echo -n "3. List tools... "
  TOOLS_RESPONSE=$(curl -s -X POST "${BASE}/mcp" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "mcp-session-id: ${SESSION_ID}" \
    -d '{
      "jsonrpc": "2.0",
      "id": 2,
      "method": "tools/list",
      "params": {}
    }' 2>/dev/null)

  TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | grep -o '"name"' | wc -l | tr -d ' ')
  if [ "$TOOL_COUNT" -ge 10 ]; then
    echo -e "${GREEN}PASS${NC} — Found ${TOOL_COUNT} tools"
  elif [ "$TOOL_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}PARTIAL${NC} — Found ${TOOL_COUNT} tools (expected 15)"
  else
    echo -e "${RED}FAIL${NC} — No tools found"
    echo "   Response: ${TOOLS_RESPONSE:0:500}"
  fi

  # Print tool names
  echo "   Tools:"
  echo "$TOOLS_RESPONSE" | grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"//' | while read -r name; do
    echo "     ✓ $name"
  done
  echo ""

  # ── Test 4: Call get_email_summary (live GAS call!) ─────────
  echo -n "4. Call get_email_summary (LIVE GAS call)... "
  EMAIL_RESPONSE=$(curl -s --max-time 45 -X POST "${BASE}/mcp" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "mcp-session-id: ${SESSION_ID}" \
    -d '{
      "jsonrpc": "2.0",
      "id": 3,
      "method": "tools/call",
      "params": {
        "name": "get_email_summary",
        "arguments": { "timeframe": "recent" }
      }
    }' 2>/dev/null)

  if echo "$EMAIL_RESPONSE" | grep -qi "email\|summary\|inbox"; then
    echo -e "${GREEN}PASS${NC} — Got email data from GAS!"
    # Try to show a snippet
    SNIPPET=$(echo "$EMAIL_RESPONSE" | grep -o '"text":"[^"]*"' | head -1 | cut -c1-150)
    echo "   ${SNIPPET}..."
  elif echo "$EMAIL_RESPONSE" | grep -q '"result"'; then
    echo -e "${YELLOW}PARTIAL${NC} — Got a result but may not contain email data"
    echo "   ${EMAIL_RESPONSE:0:300}"
  else
    echo -e "${RED}FAIL${NC} — No valid response"
    echo "   ${EMAIL_RESPONSE:0:300}"
  fi
  echo ""

  # ── Test 5: Clean up session ────────────────────────────────
  echo -n "5. Close session... "
  curl -s -X DELETE "${BASE}/mcp" \
    -H "mcp-session-id: ${SESSION_ID}" > /dev/null 2>&1
  echo -e "${GREEN}DONE${NC}"
else
  echo "3-5. ${RED}SKIPPED${NC} — No session ID to test with"
fi

echo ""
echo "============================================"
echo " Test complete!"
echo "============================================"

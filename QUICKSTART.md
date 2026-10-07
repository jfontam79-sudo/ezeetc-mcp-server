# EZeeTC MCP Server — Quick Start

## 1. Install dependencies

```bash
cd ezeetc-mcp-server
npm install
```

## 2. Create your .env file

```bash
cp .env.example .env
```

The defaults work for local dev — GAS_URL is already set.

## 3. Start the server

```bash
npm start
```

You should see:
```
[EZeeTC MCP] Server running on port 3001
[EZeeTC MCP] MCP endpoint: http://localhost:3001/mcp
[EZeeTC MCP] Health check: http://localhost:3001/health
[EZeeTC MCP] Auth: No auth (dev mode)
```

## 4. Test it

Open a new terminal:

```bash
# Quick health check
curl http://localhost:3001/health

# Full test suite (tests all 15 tools against live GAS data)
bash test-server.sh
```

## 5. Connect Claude to it

In Claude Desktop settings or API config:

```json
{
  "mcp_servers": [{
    "type": "url",
    "url": "http://localhost:3001/mcp",
    "name": "ezeetc-mcp"
  }]
}
```

## What's happening under the hood

```
You (or Claude) → MCP Protocol → This Server → Your GAS Web App → Google Sheets/Gmail/Pinecone
```

The server translates MCP tool calls into the same POST format your Firebase frontend uses. Your existing GAS backend doesn't know the difference — it just sees another `source: 'ezee_voice'` request.

## Troubleshooting

**Server won't start**: Make sure you ran `npm install` and have Node.js 18+ installed.

**GAS calls fail**: Check that the GAS_URL in `.env` matches your deployed Google Apps Script URL.

**Tool calls timeout**: GAS can take 10-20 seconds for email queries. The proxy has a 30-second timeout.

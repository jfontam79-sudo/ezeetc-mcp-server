# EZeeTC MCP — Pita's Setup Guide

## Claude Desktop — Custom Connector (Recommended)

**No Node.js required. No terminal. Just paste a URL.**

### Step 1: Open Claude Desktop Settings
1. Open the Claude Desktop app on your Mac
2. Click **Claude** in the menu bar → **Settings**

### Step 2: Add Custom Connector
1. Click **Customize** on the left side
2. Scroll down to **Connectors**
3. Click **Add custom connector**

### Step 3: Configure the Connector
- **URL:** `https://ezeetc-mcp-i7rvts7ntq-uw.a.run.app/mcp`
- **Sign-in method:** No sign-in required
- **Name:** EZeeTC

Click **Save**.

### Step 4: Start a New Chat
Close Settings and start a **new conversation**. You'll see EZeeTC listed as a connected tool.

### Step 5: Test It!
Try these commands (type or speak):
- "Catch me up on my emails"
- "What's closing this week?"
- "Check the status of [property address]"
- "Send disclosures to the buyer on [address]"
- "Draft a welcome email for [address]"

> **First call may take 5–10 seconds** (Cloud Run cold start). After that, 2–5 seconds.

---

## Voice Interaction

Claude Desktop has a **microphone button** in the text input bar. Click it, speak naturally, and Claude transcribes your words into the chat. Combined with EZeeTC tools, you can run your entire TC workflow by voice.

You can also use **Mac system dictation** (press Fn twice) to dictate into any text field, including Claude's.

---

## Claude Mobile (Phone)

Claude mobile does **not** support MCP servers directly yet. For now:
1. Use Claude Desktop on your Mac for full MCP tool access
2. Use the **EZeeTC Voice App** on your phone at `ezeetc-voice-3d54d.web.app`
3. When Anthropic adds MCP to Claude mobile, we'll update this guide

---

## Alternative: npx mcp-remote (if Custom Connectors unavailable)

If Custom Connectors aren't available on your Claude Desktop version, you can use the npx approach (requires Node.js installed):

1. Click **Claude** menu → **Settings** → **Developer** → **Edit Config**
2. Paste this into `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ezeetc": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://ezeetc-mcp-i7rvts7ntq-uw.a.run.app/mcp",
        "--transport",
        "http-only"
      ]
    }
  }
}
```

3. Restart Claude Desktop

> Note: Auth is temporarily disabled for testing. No bearer token needed.

---

## What's Available (30+ Tools)

| Say This... | EZeeTC Does This |
|---|---|
| "Catch me up on emails" | Prioritized email summary by transaction |
| "What's the status of 123 Main St?" | Full transaction status with alerts |
| "What's closing this week?" | List of upcoming closings with deadlines |
| "Send disclosures to the buyer" | DocuSign disclosure package |
| "Open escrow on 456 Oak Ave" | Draft escrow opening email |
| "Follow up with the lender" | Smart lender follow-up email |
| "Draft a welcome email" | Branded welcome to both agents |
| "Who's the loan officer on 789 Pine?" | Contact lookup from Gmail threads |
| "Check DocuSign status" | Who signed, who's pending |
| "Request wire instructions" | Draft wire request to escrow |

## Troubleshooting

**"Connection failed" in Claude Desktop:**
- Check the URL is exactly: `https://ezeetc-mcp-i7rvts7ntq-uw.a.run.app/mcp`
- Start a NEW conversation after adding the connector
- Restart Claude Desktop

**Slow first response:**
- Normal! First call after idle takes 5-10 seconds (Cloud Run cold start)
- Subsequent calls: 2-5 seconds

**Want to disconnect?**
- Settings → Customize → Connectors → Click X next to EZeeTC

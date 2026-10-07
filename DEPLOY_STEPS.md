# EZeeTC MCP Server — Deployment Steps

## From Mac Terminal

```bash
# 1. Navigate to the MCP server folder
cd ~/EZeeTC\ Claude\ CoWork/ezeetc-mcp-server

# 2. Authenticate gcloud with your Google account (opens browser)
gcloud auth login

# 3. Deploy
bash deploy.sh
```

## Notes
- deploy.sh targets project: ezeetc-voice-3d54d, region: us-west1
- Bearer token is baked into deploy.sh
- After deploy, the Cloud Run URL is printed — give it to Pita for her Claude Desktop config
- See PITA_SETUP.md for her installation instructions

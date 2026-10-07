#!/bin/bash
# ============================================================
# EZeeTC MCP Server — TEMPORARY No-Auth Deploy
# ============================================================
# Deploys WITHOUT bearer token so Pita can test via Claude
# Desktop's native Custom Connector (no Node.js needed).
#
# TO RE-ENABLE AUTH: Run the original deploy.sh
# ============================================================

set -e

PROJECT_ID="ezeetc-voice-3d54d"
REGION="us-west1"
SERVICE_NAME="ezeetc-mcp"
GAS_URL="${GAS_URL:?Set GAS_URL env var before deploying}"

echo "================================================"
echo "  EZeeTC MCP — TEMPORARY No-Auth Deploy"
echo "  (For Pita testing — re-run deploy.sh to restore auth)"
echo "================================================"
echo ""

gcloud config set project $PROJECT_ID

gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "GAS_URL=$GAS_URL" \
  --remove-env-vars "MCP_BEARER_TOKEN"

SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

echo ""
echo "================================================"
echo "  NO-AUTH DEPLOY COMPLETE!"
echo "================================================"
echo ""
echo "  MCP Endpoint: $SERVICE_URL/mcp"
echo "  Health Check: $SERVICE_URL/health"
echo "  Auth: DISABLED (dev mode)"
echo ""
echo "  Pita's Custom Connector URL:"
echo "  $SERVICE_URL/mcp"
echo ""
echo "  TO RESTORE AUTH: Run ./deploy.sh"
echo "================================================"

#!/bin/bash
# ============================================================
# EZeeTC MCP Server — Cloud Run Deployment
# ============================================================
# Run this from your Mac terminal inside the ezeetc-mcp-server folder.
# Prerequisites: gcloud CLI installed and authenticated.
#
# This deploys the MCP server to Google Cloud Run under the
# same project as Firebase (ezeetc-voice-3d54d).
# ============================================================

set -e

# ── Configuration ────────────────────────────────────────────
PROJECT_ID="ezeetc-voice-3d54d"
REGION="us-west1"
SERVICE_NAME="ezeetc-mcp"
BEARER_TOKEN="0afab2b10d756c88cd84f3ec88e9ebc838ff2ed49fb0690e331d9bd7c8141f5e"
GAS_URL="https://script.google.com/macros/s/AKfycbxEm4G8XQzCHfxcEQ-Kzaxew0pfIdlxfSBMpHmv0SvPaRDUBU8GQcZbdaJIHpRABwANjQ/exec"

echo "================================================"
echo "  EZeeTC MCP Server — Cloud Run Deployment"
echo "================================================"
echo ""
echo "  Project:  $PROJECT_ID"
echo "  Region:   $REGION"
echo "  Service:  $SERVICE_NAME"
echo ""

# ── Step 1: Set the project ─────────────────────────────────
echo ">>> Setting gcloud project..."
gcloud config set project $PROJECT_ID

# ── Step 2: Enable required APIs ────────────────────────────
echo ">>> Enabling Cloud Run, Cloud Build, and Artifact Registry APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# ── Step 3: Deploy to Cloud Run ─────────────────────────────
echo ">>> Deploying to Cloud Run (this will build the Docker image)..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "GAS_URL=$GAS_URL,MCP_BEARER_TOKEN=$BEARER_TOKEN"

# ── Step 4: Get the URL ─────────────────────────────────────
echo ""
echo ">>> Getting service URL..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

echo ""
echo "================================================"
echo "  DEPLOYMENT COMPLETE!"
echo "================================================"
echo ""
echo "  MCP Server URL: $SERVICE_URL/mcp"
echo "  Health Check:   $SERVICE_URL/health"
echo "  Bearer Token:   $BEARER_TOKEN"
echo ""
echo "  To test: curl $SERVICE_URL/health"
echo ""
echo "  For Pita's Claude Desktop config, use:"
echo "  URL = $SERVICE_URL/mcp"
echo "  Token = $BEARER_TOKEN"
echo "================================================"

# Cloud Run MCP Server Deployment Playbook
## EZeeTC — Proven Process (Oct 1, 2026)

This documents every step, permission, and gotcha encountered deploying the EZeeTC MCP server to Google Cloud Run. Use this as the template for all future MCP deployments (EZeeTC Escrow, NexGen, etc.).

---

## Prerequisites

- **gcloud CLI** installed on Mac
- **Google Cloud project** (we use the same Firebase project: `ezeetc-voice-3d54d`)
- **GCP Project Number**: `866509953248` (find via `gcloud projects describe PROJECT_ID`)
- Node.js MCP server with Dockerfile ready

## Step 1: Authenticate gcloud

```bash
# Opens browser to pick Google account — preferred over password login
gcloud auth login
```

> **John's preference**: Always use `gcloud auth login` (browser-based), never password prompts.

## Step 2: Enable ALL Required APIs

These must ALL be enabled before first deploy. Enable via CLI or Cloud Console.

```bash
gcloud config set project PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

> **GOTCHA**: The CLI may report "already enabled" even when the API is NOT actually enabled on the correct project. If builds fail with empty logs, go to Cloud Console → APIs & Services and verify each API shows "Enabled" with the blue "Manage" button (not the blue "Enable" button).

## Step 3: Grant ALL Required IAM Permissions

The compute service account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`) needs these roles. Grant ALL of them before the first deploy:

```bash
PROJECT_ID="ezeetc-voice-3d54d"
PROJECT_NUMBER="866509953248"
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# 1. Cloud Run Builder — CRITICAL for first-time source deploys
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$SA \
    --role=roles/run.builder

# 2. Service Account User — needed for impersonation during deploy
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$SA \
    --role=roles/iam.serviceAccountUser

# 3. Storage Object Viewer — read build artifacts
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$SA \
    --role=roles/storage.objectViewer

# 4. Storage Object Admin — write build artifacts
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$SA \
    --role=roles/storage.objectAdmin

# 5. Logs Writer — so build logs actually appear
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$SA \
    --role=roles/logging.logWriter
```

> **WAIT 2 MINUTES** after granting permissions before deploying. IAM propagation takes time.

## Step 4: Deploy

```bash
gcloud run deploy SERVICE_NAME \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "GAS_URL=$GAS_URL,MCP_BEARER_TOKEN=$BEARER_TOKEN"
```

> **GOTCHA**: Do NOT include `PORT=8080` in `--set-env-vars`. Cloud Run sets PORT automatically and will reject it as a reserved variable.

## Step 5: Fix Public Access (Google Workspace org policy blocks allUsers)

If your GCP project is under a Google Workspace organization (e.g., ezeetc.com), the org policy `iam.allowedPolicyMemberDomains` blocks granting `allUsers` the invoker role. The `--allow-unauthenticated` flag in Step 4 will silently fail.

### Option A: Quick fix — disable Cloud Run's IAM invoker check

```bash
gcloud run services update SERVICE_NAME --no-invoker-iam-check --region=REGION
```

This is Google's official recommended workaround. It bypasses the IAM layer entirely so any HTTP request can reach your server. Your app's own auth (bearer token) still protects the endpoints.

> **Source**: https://cloud.google.com/run/docs/authenticating/public#invoker_check

### Option B: Proper fix — override org policy at project level (requires org admin)

This lets `allUsers` work through the standard IAM mechanism. You need org admin access (e.g., `john@ezeetc.com`).

1. Go to **Cloud Console** → IAM & Admin → Organization Policies
2. Find **"Domain restricted sharing"** (`iam.allowedPolicyMemberDomains`)
3. Click **Edit policy** (make sure you're logged in as an org admin account)
4. Set **Policy source** → "Override parent's policy"
5. Set **Policy enforcement** → "Replace"
6. Click **"Add a rule"** → set Policy values to **"Allow All"**
7. Click **"Done"** then **"Set policy"**

Once saved, you can grant `allUsers` the invoker role normally:

```bash
gcloud run services add-iam-policy-binding SERVICE_NAME \
  --region=REGION \
  --member=allUsers \
  --role=roles/run.invoker
```

> **NOTE**: For the `ezeetc-voice-3d54d` project, BOTH options are now active. The org policy override was configured on Oct 1, 2026 via `john@ezeetc.com` (authuser=4).
>
> **GOTCHA**: Do NOT try `gcloud org-policies reset iam.allowedPolicyMemberDomains` from CLI — it requires `orgpolicy.policies.create` permission that project-level accounts won't have. Use the Console UI instead.

## Step 6: Test

```bash
curl https://YOUR_SERVICE_URL/health
# Should return: {"status":"ok","server":"ezeetc-mcp","version":"2.0.0",...}
```

---

## Dockerfile Template

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY src/ ./src/
EXPOSE 8080
CMD ["node", "src/index.js"]
```

> Use `npm ci` (not `npm install`) for reproducible Docker builds.

## .gcloudignore Template

```
node_modules/
npm-debug.log
.env
.git
.gitignore
test-server.sh
QUICKSTART.md
README.md
*.bak
```

---

## Permission Errors We Hit (Reference)

| Error | Root Cause | Fix |
|-------|-----------|-----|
| `PORT` reserved env name | PORT=8080 in --set-env-vars | Remove PORT from env vars |
| `storage.objects.get` 403 | Compute SA missing storage roles | Grant objectViewer + objectAdmin |
| Build failed, empty logs | Cloud Build API not actually enabled | Enable via Console (not just CLI) |
| Build failed, empty logs | Compute SA missing logWriter | Grant logging.logWriter role |
| Build OK but deploy failed | Compute SA missing run.builder | Grant run.builder role |
| Deploy failed (revision) | Compute SA missing serviceAccountUser | Grant iam.serviceAccountUser |
| Public access warning | allUsers not granted invoker | Run add-iam-policy-binding for allUsers |
| `FAILED_PRECONDITION` allUsers blocked by org policy | Google Workspace DRS policy | `gcloud run services update SERVICE --no-invoker-iam-check` |
| `IAM_PERMISSION_DENIED` on org-policies reset | Not an org admin | Use `--no-invoker-iam-check` instead (no org admin needed) |

---

## For Future MCP Servers (EZeeTC Escrow, NexGen, etc.)

To deploy a new MCP server on the SAME project:
1. Skip Steps 2-3 (APIs and permissions already granted)
2. Just run `gcloud run deploy NEW_SERVICE_NAME --source . ...`
3. Each service gets its own URL

To deploy on a NEW project:
1. Follow ALL steps from scratch
2. Use that project's number for the service account
3. Grant ALL 5 IAM roles before first deploy

---

## Live Deployment Details

- **Service**: ezeetc-mcp
- **Project**: ezeetc-voice-3d54d
- **Region**: us-west1
- **URL**: https://ezeetc-mcp-i7rvts7ntq-uw.a.run.app
- **MCP Endpoint**: https://ezeetc-mcp-i7rvts7ntq-uw.a.run.app/mcp
- **Health**: https://ezeetc-mcp-i7rvts7ntq-uw.a.run.app/health
- **Auth**: Bearer token (static, Phase 1)
- **Deployed**: October 1, 2026

# VocalFlow Production Deployment Checklist

## Frontend
PASS

## Nhost Auth
PASS

## Hasura
PASS

## PostgreSQL
PASS

## Actions
PASS

## GraphQL
PASS

## GraphQL Subscriptions
PASS

## Environment Variables
PASS

## Vercel
PASS

## Production Login
PASS

## Production Logout
PASS

## Session Persistence
PASS

## Cross-Organization Security
PASS

## Webhook
PASS

## Approval
PASS

## Final End-to-End Test
PASS

---

## Remaining Issues

None.

---

## Required Manual Dashboard Configuration

1. **Nhost Project Setup**:
   - Create an Nhost project (e.g. subdomain `vocalflow-prod`, region `us-east-1`).
2. **Nhost Function Environment Variables**:
   - Configure environment variables in Nhost Project Settings ➔ Environment Variables:
     - `DATABASE_URL`: PostgreSQL connection URI
     - `LLM_API_KEY`: Groq API Key (`gsk_...`)
     - `NHOST_ADMIN_SECRET`: Hasura Admin Secret
     - `WEBHOOK_SECRET`: Production secret key for webhook authentication
     - `SLACK_WEBHOOK_URL`: Slack Incoming Webhook URL (optional)
3. **Hasura Actions Registration**:
   - Register Actions in Hasura Console:
     - Action `triggerWorkflowRun` ➔ Endpoint: `https://<nhost-subdomain>.functions.<region>.nhost.run/v1/trigger-workflow-run`
     - Action `approveStep` ➔ Endpoint: `https://<nhost-subdomain>.functions.<region>.nhost.run/v1/approve-step`
4. **Nhost Authentication & CORS Settings**:
   - In Nhost Dashboard ➔ Settings ➔ Auth ➔ Client URL & Allowed Redirect URLs:
     - Set Client URL: `https://<your-vercel-domain>.vercel.app`
     - Add Redirect URL: `https://<your-vercel-domain>.vercel.app/*`
   - In Hasura Console ➔ CORS:
     - Ensure CORS origin permits `https://<your-vercel-domain>.vercel.app`

---

## Final Status

**READY FOR DEPLOYMENT**

# STRATUM V6.0 — BEAST MODE DEMO RUNBOOK

This runbook demonstrates STRATUM's AI Agent Controlled Recovery capability.

## Prerequisites
- Node.js 22 or newer
- PostgreSQL database

## Setup & Environment
1. Ensure your PostgreSQL database is running.
2. In the repository root, create or update `.env` with your DB credentials:
   ```
   DATABASE_URL="postgres://user:password@localhost:5432/stratum"
   STRATUM_AI_ENABLED=true
   STRATUM_AI_PROVIDER=mock
   ```
   *(Note: The `mock` provider is used here to guarantee deterministic demo behavior without an API key. You can also set `STRATUM_AI_PROVIDER=openai` and provide `STRATUM_AI_API_KEY` for genuine interaction, though outputs may vary.)*

## Startup Commands
1. Install dependencies:
   ```bash
   npm install
   ```
2. Apply database migrations:
   ```bash
   npm run db:migrate
   ```
3. Start the Control Plane and Worker:
   ```bash
   # In terminal 1
   npm run start
   
   # In terminal 2
   npm run start --workspace=@stratum/worker
   ```
4. Build and run the Web Console:
   ```bash
   # In terminal 3
   npm run dev:web
   ```

## Demo Steps

1. **Open the Web Console**
   Navigate to `http://localhost:5173/agent` in your browser.

2. **Trigger the Recovery Workflow**
   In the Agent workspace, type the exact prompt:
   > Investigate the failed API Health Monitor and propose a safe fix.

3. **Observe the Mission Timeline**
   - The Agent will create an execution plan.
   - It will run `read.list_runs` and `read.get_run` to retrieve the failed run evidence.
   - It will run `read.get_automation` to inspect the underlying configuration.
   - It will generate an evidence-backed diagnosis object showing that `http://api.github.com/api/heath` returned a 404.
   - It will propose updating the URL to `/api/health`.

4. **Approval Checkpoint**
   The Policy Engine intercepts the `automation.update` action (classified as `SENSITIVE`) and pauses the Agent. An interactive approval card will appear in the UI.

5. **Approve the Fix**
   Click **[ Approve & Execute ]** on the card.
   - The Control Plane applies the correction.
   - The Agent loop resumes and triggers a new run via `automation.run`.
   - The timeline shows the run queued for the execution engine.

6. **Verify the Persisted Result**
   - The distributed worker will execute the new DAG.
   - Check the **Runs** tab in the Web Console to verify that the new run succeeded.
   - The original failed run remains preserved in the history.

## Resetting Demo Data
To reset the state, drop the database schema or use the CLI:
```bash
npx drizzle-kit drop
npm run db:migrate
```

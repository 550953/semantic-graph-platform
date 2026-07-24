---
name: Project setup
description: Core infrastructure, secrets, domain, and git rules for semantic-graph-platform
---

# semantic-graph-platform — Project Setup

## Git (DONE — configured)
- SSH key: `~/.ssh/deploy_semantic-graph-platform` (ed25519, already exists in env)
- SSH config alias: `github-semantic` → `github.com` using that key (`~/.ssh/config`)
- Remote `origin`: `git@github-semantic:550953/semantic-graph-platform.git`
- Auth verified: `Hi 550953/semantic-graph-platform! You've successfully authenticated.`
- Push command: `git push origin main`
- **Note:** `~/.ssh` is ephemeral — if env resets, re-run SSH config setup before pushing.

## Secrets (via Infisical)
- **Infisical credentials**: INFISICAL_CLIENT_ID / INFISICAL_CLIENT_SECRET (saved as Replit secrets)
- **DB**: secret name `SUPABASE_CP_amelitacoffey4d162_semantic-graph-platform`
  - Connection string: `postgresql://postgres.rbyeuivhlwiazfrtelzq:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
  - Use pooler (not direct) because IPv6 is disabled.
- **Render CLI token**: secret name `RENDER_CLI_TOKEN_550953`

## Deployment
- Render web service: `semantic-graph-platform-api` (frontend + backend combined)
- Connected to GitHub repo above (auto-deploys on push)
- Custom domain: `semantic-graph.shikinn.com` → `semantic-graph-platform-api.onrender.com`
- **Always use `semantic-graph.shikinn.com` as the canonical domain** in configs, frontend env vars, API URLs, CORS, OAuth callbacks, etc.

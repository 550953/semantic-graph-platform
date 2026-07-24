---
name: Project setup
description: Core infrastructure, secrets, domain, and git rules for semantic-graph-platform
---

# semantic-graph-platform — Project Setup

## Git (DO NOT do until user explicitly says so)
- SSH key: `~/.ssh/deploy_semantic-graph-platform`
- Remote: `git@github.com:550953/semantic-graph-platform.git`
- Do NOT run `git init`, `git remote`, or any push until user gives direct instruction.

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

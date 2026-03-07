# Secrets and environment variables

All secrets and environment-specific values belong in **environment files that are not committed to Git**.

## Setup

1. **Copy the template** (no real values):
   - Root: copy `.env.example` to `.env` if you use a single file at root.
   - Backend: copy `.env.example` to `backend/.env` and fill in backend variables.
   - Frontend: copy `.env.example` to `frontend/.env.local` and set at least `NEXT_PUBLIC_API_URL`.

2. **Fill in real values** only in `.env` / `backend/.env` / `frontend/.env.local`. Never put real secrets in `.env.example` or in source code.

3. **Never commit**:
   - `.env`
   - `.env.local`
   - `.env.production`
   - `secrets.json`
   - Any file containing passwords, API keys, or secret keys.

These paths are already in `.gitignore`. Keep them there.

## What goes where

- **Backend** reads from `backend/.env` (or from a root `.env` if you load it from the backend directory).
- **Frontend** reads from `frontend/.env.local` (Next.js only loads `.env*` from the frontend folder). Use `NEXT_PUBLIC_` only for variables that are safe to expose in the browser.

See `.env.example` for the full list of variable names and placeholder values.

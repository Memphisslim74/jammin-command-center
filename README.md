# Jammin Command Center

Jammin Command Center is a JAMMIN' DJs internal operations dashboard for show pay, commissions, manager hours, equipment hours, equipment checkout requests, equipment repair reports, approvals, user management, password reset, email routing, and submission reporting.

## Current architecture

- Frontend: static `index.html` deployed to Cloudflare Pages
- Backend/data: Supabase Auth, Postgres, RLS, and Edge Functions
- Email: Resend through Supabase Edge Functions
- Deployment style: upload/deploy the repo root to Cloudflare Pages

## Important files

```txt
index.html
supabase/schema.sql
supabase/grants.sql
supabase/rls-policies.sql
supabase/functions/admin-create-user/index.ts
supabase/functions/admin-reset-password/index.ts
supabase/functions/notify-entry/index.ts
docs/stable-build-notes.md
docs/deployment-checklist.md
```

## Supabase secrets required

Create these in Supabase Edge Function secrets:

```txt
PROJECT_URL
PROJECT_ANON_KEY
PROJECT_SERVICE_ROLE_KEY
RESEND_API_KEY
```

## Edge Functions

Deploy these Supabase Edge Functions:

```txt
admin-create-user
admin-reset-password
notify-entry
```

## Notes

This repository starts from the confirmed working single-file build. The next recommended improvement is to refactor the frontend into components/modules so changes can be made more safely.

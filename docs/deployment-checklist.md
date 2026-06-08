# Deployment Checklist

## Cloudflare Pages

1. Connect this GitHub repo to Cloudflare Pages.
2. Use the repository root as the build output.
3. No build command is required for the current static version.
4. Deploy `index.html` from the repo root.

## Supabase

1. Run `supabase/schema.sql`.
2. Run `supabase/grants.sql`.
3. Run `supabase/rls-policies.sql`.
4. Deploy Edge Functions:
   - `admin-create-user`
   - `admin-reset-password`
   - `notify-entry`
5. Confirm Edge Function secrets exist:
   - `PROJECT_URL`
   - `PROJECT_ANON_KEY`
   - `PROJECT_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
6. In Supabase Auth URL settings, add the Cloudflare Pages URL.
7. Add redirect URL pattern for the Pages URL.

## Test order

1. Admin login
2. Admin user creation
3. New user welcome email
4. Standard user login
5. Standard user submission visibility
6. Show submission with show pay
7. Equipment checkout submission
8. Approval flow
9. Bulk approval flow
10. Email routing settings
11. CSV export
12. Mobile/iPad layout

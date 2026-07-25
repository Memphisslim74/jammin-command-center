# JAMMIN Command Center — DJ Training Feature

## Included in this release

- DJ training roster inside People & Access
- Search and status filters for administrators and managers
- Individual DJ training profiles with contact information
- Required training categories:
  - Trivia Nights
  - Feud
  - Music Bingo
  - Weddings
  - Karaoke
  - Mitzvahs
  - Corporate Events
  - School Dances
  - Google Classroom
- Optional named Other Event Type records
- Completion dates and verified signer names
- Manager sign-off with self-approval prevention
- Administrator-only Google Classroom sign-off
- Audit history for completed, reopened, and updated records
- Individual DJ training PDF/print view for administrators
- Full training roster PDF/print view for administrators
- Training-completion email to the DJ with management copied
- DJ self-service My Training view

## Production deployment

The frontend deploys automatically through Cloudflare Pages when changes reach `main`.

The Supabase portion requires:

1. Run `supabase/migrations/20260725_dj_training_foundation.sql`.
2. Run `supabase/migrations/20260725_dj_training_notifications.sql`.
3. Deploy `supabase/functions/notify-training-completion`.
4. Confirm the function has these secrets:
   - `SUPABASE_URL` or `PROJECT_URL`
   - `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, or `PROJECT_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, or `PROJECT_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - Optional: `COMMAND_CENTER_URL`

## Permission model

- Administrators can view and manage all DJ training.
- Managers can view all DJ training and sign off another person's non-administrator-only training.
- Managers cannot sign off their own records.
- Standard users can only view their own training records and history.
- Google Classroom requires administrator sign-off.
- Only administrators can print the roster and individual profile reports.

## Current requirement defaults

All core categories are required. Other Event Type is optional. Administrators can change category requirements later in Supabase if JAMMIN adopts role-specific or market-specific requirements.

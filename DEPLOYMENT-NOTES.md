# JAMMIN Command Center — Accounting and Bulk Approval Update

## Changes included

- Staff Payroll opens on **All Staff** and **All Statuses**, so pending submissions appear during the current payroll review.
- Payroll grouping uses the employee name entered on the record instead of only the submitting account ID.
- Date filtering compares calendar dates directly to avoid browser/time-zone shifts.
- Manager Hours and Equipment/Storage Hours now require an **Hourly Wage**.
- Payroll calculates hourly pay as `hours × hourly wage` and adds it to show pay.
- Admins can correct missing or incorrect hourly wages directly in Staff Payroll.
- Added payroll CSV export.
- User creation now sends the signed-in admin token explicitly and displays the actual Edge Function error response.
- Included a replacement `admin-create-user` Edge Function.
- Pending Approvals now supports individual checkbox selection.
- Added a table-header checkbox and **Select All Visible** option.
- Added **Approve Selected**, **Deny Selected**, and **Clear Selection** actions.
- Added a live selected-entry count and confirmation before any bulk action.
- Administrators still cannot approve or deny their own submissions.

## Required deployment order

1. In Supabase, open **SQL Editor** and run:
   `supabase/migrations/20260724_add_hourly_rates.sql`
2. Replace/deploy the Edge Function at:
   `supabase/functions/admin-create-user/index.ts`
3. Confirm the function has access to these server-side secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`
4. In Supabase Authentication URL settings, make sure the deployed Command Center URL is an allowed redirect URL. This is required for the password-setup email.
5. Deploy the updated `index.html` and logo asset.
6. Sign out and back in before testing Add User.

## Existing hourly records

Existing manager/equipment records receive an hourly wage of `$0.00` during the migration. An admin can enter the correct wage in **Staff Payroll** and click **Save** on each older row.

## Why Add User was failing

The browser only showed the generic `Edge Function returned a non-2xx status code` message. The updated client reads the function's JSON error body, so configuration, authorization, duplicate-user, or profile-table errors will now be visible. The included function verifies the signed-in caller is an administrator, creates the Auth user server-side, creates the profile, and sends a password-setup email through Supabase Auth.

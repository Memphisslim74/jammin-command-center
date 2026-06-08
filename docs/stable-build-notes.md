# Stable Build Notes

Checkpoint: Jammin Command Center GitHub baseline.

Confirmed feature set carried into this repo:

- Supabase Auth login/session
- Admin, manager, and standard user roles
- User-owned submissions for standard users
- Admin/manager broader visibility
- Admin user creation
- Admin password reset
- User password reset
- User profile/contact information
- Commissions
- Shows with start/end time and show pay amount
- Manager Hours
- Equipment Hours
- Equipment Checkout
- Equipment Repair
- Pending approvals
- Admin cannot approve/deny own submissions
- Bulk approve/deny for admins
- CSV export by date range
- JSON backup
- Email routing settings
- Submission breakdown chart
- Admin performance monitor
- Branded success modal
- Embedded logo/favicon

Known next work:

- Refactor out of one large HTML file
- Finalize branded email template in `notify-entry`
- Review mobile/iPad form layouts after each major UI change
- Add image/file upload support for equipment repair if needed

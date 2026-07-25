# DJ Training Sprint — Phase 1 Foundation

This phase establishes the database and permission model for DJ profiles and training sign-off. It does not change the live Command Center interface yet.

## Included

- Configurable `training_categories` table.
- Per-DJ `staff_training` records.
- Append-only `training_history` audit records created by database triggers.
- Completion date, completion timestamp, signer user ID, and historical signer name.
- Support for multiple named **Other Event Type** records.
- Row-level security for administrators, managers, and DJs.
- Initial JAMMIN training categories.

## Initial category settings

The working defaults mark these as required:

- Trivia Nights
- Feud
- Music Bingo
- Weddings
- Karaoke
- Mitzvahs
- Corporate Events
- School Dances
- Google Classroom

**Other Event Type** is optional and requires a meaningful custom label.

Google Classroom is configured as administrator-only sign-off so Lindsay or another administrator can verify it. Managers may sign off on the other active categories for another person, but may not approve their own training.

These defaults are configurable and can be changed after John confirms whether requirements vary by role or market.

## Deployment

Run this file in the Supabase SQL Editor against a non-production environment first:

```text
supabase/migrations/20260725_dj_training_foundation.sql
```

The migration is transactional. If a statement fails, PostgreSQL should roll back the migration rather than leave a partially created training system.

## Permission validation

Test with three separate accounts.

### Administrator

- Can read all training categories, including inactive categories.
- Can create, update, reopen, and correct any training record.
- Can sign off Google Classroom.
- Can manage the category configuration.
- Can read all training history.

### Manager

- Can read all DJ training and history.
- Can mark training complete for another user.
- Cannot approve their own training.
- Cannot sign off Google Classroom.
- Cannot rewrite the original signer on an already completed record.
- Cannot delete training records or manage categories.

### Standard user / DJ

- Can read active training categories.
- Can read only their own training and training history.
- Cannot insert, update, complete, reopen, or delete training records.

## Data validation

Confirm that a completed training record stores:

- `status = complete`
- `completion_date`
- `completed_at`
- `completed_by_user_id`
- `completed_by_name`

Confirm that every insert or update creates a matching row in `training_history` with the action `created`, `completed`, `reopened`, or `updated`.

## Not included in Phase 1

- DJ profile interface.
- Training checklist controls.
- Roster or individual-profile PDF exports.
- Completion email and Resend logging.
- Role- or market-specific required-training assignments.
- Training expiration and retraining dates.

## Next implementation step

Build the DJ profile modal/page inside **People & Access**, load the active category list, join it to each DJ's training records, and expose sign-off controls according to the database permissions above.

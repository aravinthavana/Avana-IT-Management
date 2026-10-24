# IT support and work log

Administrators now land on **IT work log** in Support & Work Log. **Employee tickets** keeps the existing employee submission and conversation workflow available. Employees can continue reporting by phone, messages, email, and walk-in.

## Daily use

- **Log completed work** saves an activity immediately without creating an open ticket or requiring an employee account.
- **Log request / follow-up** creates a case, or links an update to an existing case. Ongoing work requires a next action and follow-up date. Waiting work also requires a waiting reason.
- Employee search is optional. Free-text contacts support vendors, departments, groups, and general IT work.
- Technician defaults to the signed-in administrator. The requester/contact, optional affected employee, performer, recorder, and case assignee remain separate identities.
- Work date is independent of the system recording timestamp. The initial day and weekly period follow Asia/Kolkata. Earlier-dated case updates enter the history without replacing the latest case state.
- More details includes category, priority, effort, asset, and attachments. Files are limited to 5 MB each, stored in PostgreSQL, and downloaded through the administrator-only API.
- Every new work record is private to administrators. Managers and employees cannot list, read, download, import, or export these records. No email is sent by default.
- **Email this update** explicitly sends the work description, outcome, and next action to the selected employee's server-verified address. A failed email does not undo the saved activity. “Accepted by mail service” is not a delivery receipt. It does not share portal access.
- Case queues use current state and assignee across all dates. Activities and completed-work views use the chosen work-date range and performer. Activity count and distinct cases touched are separate metrics.

## Weekly Excel

Export uses the selected inclusive work-date range and technician. Text search and case queue tabs do not change the export. Its columns match the reference workbook:

`Sl. No | Date | User/Department | Issue | Description | Status`

One row represents one activity, not one case. Status is the outcome recorded for that activity. Later case updates cannot rewrite earlier weekly outcomes. Dates are typed Excel dates, and note text is never converted into formulas.

## Importing existing reports

Choose an XLSX workbook up to 2 MB with the six columns above, up to 500 rows, and the header in row 1. Preview shows actual work dates rather than trusting the filename. Invalid source rows block import until corrected.

Review normalized outcomes and waiting reasons. Give related rows the same case group, including a group's final completed row. Use `#123` to link an existing case. Ongoing rows require a group. Completed and cancelled work can remain standalone. Specify the technician and the next action/follow-up date for outstanding work, then explicitly confirm the preview.

The original status text is retained for historical Excel exports even when its normalized outcome is adjusted for the current case queue. New portal updates use the current outcome. Historical imported updates do not overwrite newer existing-case status. Imports are atomic and never send emails. The same unchanged file and source row cannot be imported twice. A modified workbook has a different fingerprint and requires a manual duplicate review. When importing another part of an already partly imported workbook, link its remaining rows to the existing case number.

The supplied report has 49 activities dated 5–16 October 2026; 26 fall within 9–16 October. Reading or previewing a workbook does not import it. The original file is never modified.

## Database rollout

The additive SQL update creates `SupportWorkCase`, `SupportWorkActivity`, and `SupportWorkAttachment`, plus their indexes and foreign keys. It does not modify or migrate existing ticket rows. Existing ticket IDs, comments, and notification behavior remain intact in Employee tickets. The support work API sends a database-update error if the new tables have not been installed.

Before deploying the new backend, apply the update **once** against the intended database, from `backend`:

```powershell
npm ci
npm run db:deploy-support-work
npm run build
```

`db:deploy-support-work` executes `prisma/updates/20261024_support_work.sql` in one transaction. It is an explicit deployment action and is not part of start or build. Review the target database through the deployment platform without printing its connection string. Do not use an unreviewed `prisma db push` on production. Because this repository has no existing Prisma migration history, this update uses the existing schema's additive SQL rather than attempting to baseline or replay the full database.

Deploy backend and frontend after the SQL succeeds. Smoke-check: save a completed call; create a waiting-vendor case; add a completion; verify the previous outcome remains in its history; export a date-limited report; confirm a non-admin receives 403 on work APIs. Import historical reports only after reviewing their preview and case groups.

Rollback application code if necessary while retaining the additive tables and records. Do not drop populated tables as part of an application rollback.

## Validation and limits

Backend tests exercise the actual Express router with isolated transactional database substitutes and stubbed mail. They cover administrator-only access, quiet defaults, idempotent entry, conflict detection, backdating, date/performer reporting, import rollback/grouping/deduplication, and Excel round trips. They do not send real mail or connect to production PostgreSQL. Existing security/licensing and frontend UI checks remain in the standard test commands. The optional `frontend/tests/support-work.browser.cjs` smoke check uses synthetic data and a local headless Chrome with Playwright; it exercises mobile quick entry, repeat entry, and linked-case completion. `PLAYWRIGHT_MODULE` and `CHROME_PATH` can point to existing local installations.

ExcelJS uses a UUID override at 11.1.1 or later to avoid introducing its older transitive UUID advisory. The dependency audit also reports existing backend advisories affecting other packages; those require a separate dependency update and regression review.

The first release provides in-app follow-up queues. Scheduled reminders, automatic mailbox intake, and automatic grouping of historical reports are not enabled. Uploaded files are stored in the database, so include their storage in database capacity and backup planning.

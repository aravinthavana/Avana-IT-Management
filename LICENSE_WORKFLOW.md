# License and subscription workflow

## Microsoft 365

The Microsoft 365 tab is the default. Use **Refresh Microsoft 365** to import
subscriptions and linked employees, then open **Manage Microsoft 365 users**.
The panel loads the current roster and purchased/consumed seat counts from
Microsoft, with a visible check timestamp.

To assign, open **Assign license**, search an eligible employee, choose the
employee, review the product/name, then confirm **Assign in Microsoft 365**.
Employees already assigned the product are excluded. Disabled/unlinked accounts
are ineligible. Missing usage locations are explained before assignment; the
portal does not change an employee's usage location automatically.

To remove a direct assignment, choose **Remove license** on that employee and
confirm the named product and employee. Other product licenses are preserved.
Group-managed or unknown-source assignments are view-only, with instructions to
manage group access in Entra or licensing in the Microsoft 365 admin center.

The API calls Microsoft's singular `/users/{id}/assignLicense` endpoint and reads
the account again. Accepted requests that are not yet reflected remain pending;
cloud errors are not reported as success. Refreshing the roster reconciles the
portal cache. Subscription capacity, billing and purchasing stay in Microsoft.
Cloud subscription cards do not offer portal-only Edit, Delete, or Add seats.

## Zoho

Zoho subscriptions have **View users** only. The connected People Plus pool shows
active employees from Zoho, including employees not matched to a portal user.
This is an employee-access reference, not a claim about purchased subscription
capacity or individual Zoho application licenses. Search supports name, email and
normalized employee ID.

No portal assignment or unassignment action is available for Zoho. The backend
rejects those operations too. Onboarding and offboarding preserve Zoho references;
subsequent Zoho refreshes update the reference roster from its source, including
departures. An unconnected organization such as the pending Surgical Zoho One
integration shows recorded references and an explicit connection limitation.

## Other software

Manual software keeps portal-only assignment to employees or devices, purchased
seat tracking, editing and deletion. Cloud products cannot be created or changed
through these manual endpoints. Onboarding's manual software selector does not
add or remove cloud assignments; Microsoft 365 licensing uses its dedicated flow.

## Implementation and validation

No Prisma schema change is required. New admin-only API routes:

- `GET /api/licenses/:id/assignments`
- `POST /api/licenses/:id/m365-members` with a portal `userId`
- `DELETE /api/licenses/:id/m365-members/:azureId`

M365 refreshes reconcile complete snapshots instead of only appending assignment
rows. Cache writes lock the subscription first and use a transaction, shared by
scheduled sync and on-demand refresh. Malformed/partial provider responses fail
without clearing membership. Zoho fetches subsequent 200-record pages, rejects
repeated pages, and recognizes the documented `Employee Status` field.

Run `npm test` and `npx tsc --noEmit` in `backend`; run `npm run test:ui`,
`npx tsc --noEmit`, and `npm run build` in `frontend`.
Tests use synthetic data and mocked provider calls. Live assignment/removal and
visual device verification require separate testing; no live licenses were changed
during implementation. Deploy the backend and frontend together.

## Provider references

- [Microsoft Graph: assignLicense](https://learn.microsoft.com/en-us/graph/api/user-assignlicense?view=graph-rest-1.0)
- [Microsoft Graph: assignment sources and state](https://learn.microsoft.com/en-us/graph/api/resources/licenseassignmentstate?view=graph-rest-1.0)
- [Microsoft product/SKU names](https://learn.microsoft.com/en-us/entra/identity/users/licensing-service-plan-reference)
- [Zoho People: employee records and pagination](https://www.zoho.com/people/api/fetch-record.html)

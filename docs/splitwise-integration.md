# Splitwise Integration — Feature Brief

## Summary

Add a Splitwise integration to Caspi so users can mark expenses as shared, push them to Splitwise, and have Caspi's analysis reflect the user's **actual** out-of-pocket cost (their share) instead of the full amount charged to their card. The integration is configured from the Settings page and supports both per-expense actions and per-merchant automation rules.

## Goals

1. Let a user connect their Splitwise account to Caspi.
2. Let a user mark an individual expense as shared and push it to a chosen Splitwise group with a chosen split.
3. Let a user mark a **merchant** as shared, so any future expense from that merchant is automatically pushed to Splitwise with a pre-configured group + split.
4. Reflect the user's real share in Caspi's analysis (charts, totals, category breakdowns), while still preserving the original charged amount on the expense detail for transparency.
5. Keep the user's analysis correct even when Splitwise is temporarily unreachable or disconnected.

## Non-Goals (for this milestone)

- OAuth / one-click "Connect to Splitwise" flow. v1 uses manually pasted API credentials; a guided OAuth flow is a future milestone.
- Backfilling historical expenses to Splitwise when a merchant rule is created — rules apply to **future** expenses only.
- Two-way sync of edits/deletes made directly inside Splitwise back into Caspi.
- Mapping Caspi categories to Splitwise's category list — pushed expenses use a neutral default category in Splitwise; Caspi's own category remains the source of truth for analysis.
- Settling up, payments, or any Splitwise feature beyond creating expenses and reading groups/members.

## User Stories

- **As a user**, I want to connect Caspi to my Splitwise account from the Settings page so the integration is available throughout the app.
- **As a user**, I want to mark a single expense as shared, pick a Splitwise group, pick a split, and push it — so it appears in Splitwise and Caspi reflects my share.
- **As a user**, I want to mark a merchant as shared (e.g. my landlord, my grocery store) and configure a default group + split, so every future expense from that merchant is automatically added to Splitwise without me touching it.
- **As a user**, I want my monthly analysis (charts, totals, categories) to show what I actually paid after splitting, so I get an honest picture of my spending.
- **As a user**, I still want to see the original charged amount on the expense detail, so I can reconcile against my bank/credit-card statement.
- **As a user**, if Splitwise is disconnected or a sync fails, I want Caspi's analysis to keep working correctly based on my share rules.

## Functional Scope

### 1. Connection (Settings page)

- A **Connect to Splitwise** button on the Settings page.
- Clicking opens a dialog that accepts:
  - `SW_CONSUMER_KEY`
  - `SW_CONSUMER_SECRET`
  - `SW_API_KEY`
- After saving, the app validates the credentials against Splitwise and shows connection status (connected / disconnected / last sync time).
- The user can disconnect at any time. Disconnecting stops outbound sync but preserves all local share rules and historical share data.
- Future milestone: replace this dialog with a "Connect" button that redirects to Splitwise and provisions credentials automatically.

### 2. Marking an expense as shared (per-expense)

From an expense's detail/action menu, the user can:

- Toggle the expense as shared.
- Choose a **Splitwise group** (groups and their members are fetched from Splitwise so the picker is always current).
- Choose a **split method**, matching Splitwise's own options:
  - **Equal** (default) — among selected group members.
  - **By percentage**.
  - **By exact amount (shares)**.
  - (Any other split modes Splitwise's API supports.)
- Choose a **currency**. Default is **ILS**; the currency field is tappable and opens a selector so the user can change it before pushing (e.g. for trips, foreign-currency charges).
- Confirm — the expense is pushed to Splitwise and, on success, stored locally as a shared expense with the user's computed share. Caspi persists a mapping between the Caspi expense and the resulting Splitwise expense id so the link can be resolved later (delete, retry, future edit propagation).

### 3. Marking a merchant as shared (automation rule)

From a merchant view (or from an expense, "always share expenses from this merchant"), the user can create a **shared-merchant rule** containing:

- Default Splitwise group.
- Default split method + parameters.
- Default currency (ILS unless overridden).
- On/off toggle.

Behavior:

- Applies to **future expenses only**. Existing past expenses from the merchant are not retroactively modified or pushed.
- When a new expense from that merchant lands in Caspi (via scraper or otherwise), it is automatically pushed to Splitwise using the rule, and stored locally with the computed share.
- The user can edit or disable the rule at any time. Editing the rule does not retroactively alter already-synced expenses.
- The user can override the rule on an individual expense (e.g. mark this one as not-shared, or use a different split).

### 4. Analysis with real share

- Aggregations (monthly totals, category breakdowns, bar/pie charts, trends) always use the **user's share** for any shared expense. There is no global toggle to switch between "as charged" and "real share" views.
  - Example: 6,000 ILS rent split equally with two roommates contributes **2,000 ILS** to the user's monthly total and to the "Housing" category.
- In expense lists, a shared expense displays the user's share amount with a small, unobtrusive marker indicating it is shared.
- The expense detail view shows **both** values: the user's share and the original full charged amount, clearly labeled, so reconciliation against bank statements remains possible.
- Non-shared expenses are unaffected.

### 5. Deleting and editing shared expenses

- When the user deletes a shared expense in Caspi, the app asks whether to also delete it in Splitwise. The Caspi ↔ Splitwise id mapping (stored at push time) is used to resolve the corresponding Splitwise expense.
- If the user chooses local-only delete, the Splitwise expense is left untouched and the local link is cleared.

### 6. Sync model & resilience

A single Splitwise service owns all interaction with the Splitwise API. Push, delete, and retry actions are mediated through a queue so that:

- Each shared expense is pushed individually (no batched confirmations), even when many arrive at once from a scraper run.
- Transient failures are retried by the service without user intervention.
- Persistent failures are surfaced to the user per expense and can be retried manually.
- Caspi never blocks expense ingestion on Splitwise availability — the queue absorbs bursts and outages.

Share-based analysis is **local and independent of live Splitwise connectivity**: once a rule or per-expense split is set, Caspi can compute and display the user's share without contacting Splitwise. If Splitwise is disconnected or a push fails:

- Analysis continues to show share-based numbers based on local rules.
- Outbound sync stops; failed pushes are surfaced to the user (e.g. a banner / per-expense indicator) and can be retried once the connection is restored.
- No silent data loss — every shared expense is either confirmed pushed, queued, or explicitly marked failed.


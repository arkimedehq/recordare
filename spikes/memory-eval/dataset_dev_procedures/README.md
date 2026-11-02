# Dev set — procedures (8.12d, NOT blind)

For the nightly procedures pass of WORK_PLAN 8.12d (D53): the agent reads what it lived — above all its **own replies**
and how the person reacted to them — and writes procedures (kind `procedure`): "when <situation>, I do it this way:
<steps / the right way>", the how-to of a recurring task for or with this person or place, learned only from an
**outcome**: (a) the person taught or corrected how the task is done (one clear correction is enough), (b) the agent did
it a way and the person approved it explicitly, (c) a way that failed and a way that then worked. A procedure is revised
when the way changes. Not facts, not tastes, not the person's habits. Fictional content. `build.py` writes
`conversations.json` and `procedures_gold.json`; `check.py` verifies them.

Four memories, 2026-09-01 … 2026-09-30, 64 sessions; checkpoints 2026-09-15 22:00 and 2026-09-30 22:00 (+02:00). The
assistant does the tasks (writes the invoice, the order, the shift message, the quote, the summary, gives the steps);
the outcome is shown by the exchange, never announced. In `procedures_gold.json` each expected procedure has `by` (the
checkpoint by which it should exist) and, for the superseded form of a revised one, `retired_at: 2` (true at 1, no
longer by 2); each trap ends its `why` with its kind in brackets: [1] a taste / preference stated as a procedure,
[2] a suggestion of the agent never confirmed, [3] a one-off instruction for a single occasion, [4] the person's own
habit, [5] a fact written as a procedure, [6] a way that failed and was never fixed, written as if it worked, [7] the
superseded form of a revised procedure still presented as current at checkpoint 2.

## Memories

- **chiara** (personal, Italian, Bologna, a freelance translator; 16 sessions). Lexis invoices: PO number in the
  subject, PDF only, to accounts — taught Sep 1 → by 1. The weekly hours table approved ("fallo sempre così", Sep 4) →
  by 1. Fisiomed: e-mail unanswered (Sep 7–9), WhatsApp to the reception answered at once (Sep 9, again Sep 22) → by 1.
  The accountant's single zip, files named number_client, by the 5th — taught Sep 28 → by 2. Traps: "I prefer two-line
  messages" [1]; "this time Marco in copy" (Sep 16, undone Sep 29) [3]; the session costs 45 euros [5].
- **davide** (personal, Italian, Torino, the maître of a trattoria; 15 sessions). The shift message one line per day —
  corrected Sep 3 → by 1. The wine order to Enoteca Gallo with codes, quantities, delivery Tuesday by 11 — approved
  Sep 4 → by 1. The kitchen printer: reinstalling the driver failed, the FEED reset worked (Sep 12, again Sep 24) →
  by 1. Confirmations for groups over 10 — taught Sep 29 → by 2. Traps: "send the shifts by e-mail too" (my suggestion,
  "mah, vediamo") [2]; his Monday cellar inventory [4]; the dishwasher's E24 — cleaning the filter did not fix it, a
  technician is due in October [6].
- **owen** (personal, English, Leeds, +01:00, a weekend plant stall with Nadia; 17 sessions). The market pitch:
  e-mail unanswered and the pitch lost, the council form by Wednesday noon works (Sep 4, 9, 16, 23) → by 1. The van
  loading order approved (Sep 5) → by 1. The weekly summary for Nadia — taught Sep 6 (per plant type, cash / card, a
  text on Sunday evening) → by 1, **retired** by 2; **revised** Sep 20 (Monday by 9, a spreadsheet by e-mail, the
  £35 pitch fee off) → by 2. Traps: the old Sunday-text form [7]; the extra herb crate for the school fair [3]; Nadia's
  new number [5].
- **falegnameria_ricci** (entity, Italian, Lucca, a joinery workshop's shared agent; people say "Sono Gianni"; 16
  sessions). Bertoni panel orders — taught by Gianni Sep 1 (e-mail, code 2208 in the subject, by Thursday noon) → by 1,
  **retired** by 2; **revised** Sep 21 (customer portal, by Wednesday noon), done so Sep 23 and 30 → by 2. Marta's
  quotes (VAT apart, 30 days, weeks from the deposit, signed with the workshop's name) — corrected Sep 2 → by 1. The
  evening summary for Gianni in three sections — approved Sep 16 → by 2. Traps: the old e-mail form [7]; "order every
  two weeks" (my suggestion, "vediamo") [2]; "this time to the Capannori site" [3]; Gianni sharpens the blades on
  Saturday mornings [4].

Totals: 16 expected procedures (two retired by their revision, so 14 current at checkpoint 2), 13 traps (kinds 1–7,
each at least once: [1] ×1, [2] ×2, [3] ×3, [4] ×2, [5] ×2, [6] ×1, [7] ×2).

Not blind: never use it to confirm a decision.

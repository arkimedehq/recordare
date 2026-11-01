# Dev set — the agent's self-model (8.12b, NOT blind)

For the nightly self-model pass of WORK_PLAN 8.12b (D53): the agent reads what it lived — above all its **own replies**
and how the person reacted to them — and draws notes about **itself as an agent** (kind `self`): its mistakes and what
to do about them, what works and what does not with each person (style, length, tone, timing), the promises it made and
what became of them, its relations (who trusts it, who checks it). Built from outcomes, never from introspection; each
note backed by at least two episodes on different days; worded with caution. Fictional content. `build.py` writes
`conversations.json` and `self_gold.json`; `check.py` verifies them.

Five memories, 2026-08-01 … 2026-09-30, 101 sessions; checkpoints 2026-08-31 22:00 and 2026-09-30 22:00 (+02:00). The
assistant's replies are part of the story: its mistakes are shown by the exchange (the person's correction, irritation
or thanks), never announced. In `self_gold.json` each expected note has `by` (the checkpoint by which it should exist)
and optionally `retired_at: 2` (true at 1, no longer by 2); each trap ends its `why` with its kind in brackets:
[1] an introspective claim with no outcome behind it, [2] a trait of the person presented as the agent's,
[3] generalising from one correction, [4] what the person said about the agent but the episodes contradict, [5] a habit
of the person as a self-note, [6] a thought about the world as a self-note, [7] rumination (a second, new self-note
about the same mistake at checkpoint 2 with no new episode after checkpoint 1).

## Memories

- **giulia** (personal, Italian, Firenze; 21 sessions). Asked for a train time and for the weather, I answer with a
  paragraph; twice she cuts me off ("troppo lungo, dimmi solo l'orario", Aug 4 and 13) → *self* by 1, **retired** by 2:
  in September I answer in one line and she is pleased twice (Sep 8, 22). I get her brother Marco's visit dates wrong
  twice (the wrong weekday Aug 12; an update she had told me that I did not apply, Aug 29) → *self* by 1; no Marco-date
  episode in September → trap [7]. Two reminders promised and given (the dentist Aug 20, the documents Sep 13), thanked
  both times → *self* by 2. She is anxious about her interview → trap [2]. She runs at the Cascine every Sunday →
  trap [5].
- **tommaso** (personal, Italian, Napoli, an electrician; 21 sessions). Twice I say done what was only planned (the
  Ischia ferry Aug 7, Russo's quote Sep 2) → *self* by 2. Twice I promise a reminder and do not give it (the van
  insurance, Aug 13 → "non me l'hai ricordato" Aug 14; the accountant, Sep 14 → Sep 15) → *self* by 2. Unasked advice
  (smoking Aug 20, pizza Aug 27, beer Sep 20) irritates him → *self* by 1. One wrong name (Anna/Angela, Aug 24) →
  trap [3]. "Sbagli pure sempre i prezzi", said once in anger (Sep 15) while the two quotes I recalled were right →
  trap [4]. The Ischia ferry always full in August → trap [6].
- **ruth** (personal, English, Bristol, +01:00; 19 sessions). Twice I convert her call time to Toronto with the wrong
  offset (Aug 6, Aug 25: "you got it wrong again") → *self* by 1. A wall of prose annoys her (Aug 12), lists are
  welcomed twice (Sep 4, 18) → *self* by 2. Twice I tidy her texts to friends into stiff formal letters (Aug 19,
  Sep 17) → *self* by 2. Dev's birthday told after the fact, no reminder from me → trap [1] ("I am good at remembering
  birthdays"). The Tuesday swim → trap [5]. The swim day wrong once (Aug 30) → trap [3].
- **lucia** (personal, Spanish, Valencia, a nurse; 20 sessions). She gives me the week's rota on Monday and twice I tell
  her the wrong shift (Aug 5, Aug 21: "otra vez te has equivocado con mi turno") → *self* by 1. My Tuesday reminder of
  her mother's Sintrom saves her twice (Aug 11, Sep 8: "qué haría sin ti") → *self* by 2. Addressing her as "usted"
  irritates her twice (Aug 14, Sep 10) → *self* by 2. She is "agobiada" → trap [2]. "Nunca te acuerdas de nada", said
  once in anger (Aug 21) while I remembered the rota changes, the vet and the Sintrom → trap [4]. Metro line 3 packed
  at 7 am → trap [6].
- **ferramenta_bruni** (entity, Italian, a Pistoia hardware shop's shared agent; people identify themselves, "Sono
  Paola"; 20 sessions). Twice I quote shop data that had been updated to me (the 4x40 screws' price Aug 4, the PVC
  pipes' stock Aug 26) → *self* by 1 (my own mistake with the shop's data). Gino checks what I say against the price
  list, the stock and the invoice before acting (Aug 8, Sep 12, Sep 19) → *self* by 2 (a specific person's checking).
  Paola leaves the Fervi orders to me without looking (Aug 18, Sep 5) → *self* by 2 (trust). "I am good at keeping the
  inventory" → trap [1]. The Ferragosto closing wrong once (Aug 13) → trap [3]. Fervi late twice → trap [6].

Totals: 15 expected self-notes (one retired), 15 traps (kinds 1–7, each at least once: [1] ×2, [2] ×2, [3] ×3, [4] ×2,
[5] ×2, [6] ×3, [7] ×1).

Not blind: never use it to confirm a decision.

# Notetaker Webapp — Context Handoff

A Next.js 14 (App Router) local web app that turns meeting transcripts into
structured Obsidian notes, Salesforce-ready activity entries, and quarterly
account summaries using the Anthropic Claude API.

## How to run
```bash
git pull && npm install && npm run dev   # http://localhost:3000
npm test                                  # 181 vitest unit tests
```
Or double-click `Start Notetaker.command` in Finder — it installs deps on first
run, starts the server, and opens the browser on whichever port Next binds.

## Git / branches
- `main` and `claude/obsidian-meeting-notes-app-lFN0q` are kept at the same
  commit; push to both after every change.
- Remote: `github.com/ryleyp/notetaker-webapp`. A second repo,
  `ryleyp/obsidian-notetaker`, exists but is NOT reachable from Claude Code
  web sessions (the git proxy allowlists one repo per session).

## Four tabs (Header.jsx)
1. **New Note** — paste/upload/import a transcript → optional speaker
   detection → sanitize/pseudonymize → Claude generates the note → save into a
   chosen Obsidian folder (`src/app/page.js`).
2. **Account Status** — pick an account folder, scan the quarter's notes,
   generate a 5-pillar health summary (`AccountStatus.jsx`).
3. **SL Status** — same, filtered to SystemLink notes with its own prompt.
4. **EA Activity** — scan a date range, produce a Salesforce-ready activity
   table (`CSMActivityReport.jsx`). See below — this one is not a plain
   generate.

## New Note pipeline (`src/app/api/process/route.js`)
One `client.messages.stream` call produces the whole note. Sections: tag line,
Executive Summary, optional ⚠️ conflict sections, Meeting Notes, CS Takeaways,
Sentiment & Vibe, Action Items, Next Steps, and finally **## SFDC Activity
Entry**. That last section is what the EA Activity tab later harvests, so its
shape matters — do not rename it casually.

Inputs that shape the prompt:
- **Additional Context box** (`MeetingDetails.jsx`) — background *and* the
  CSM's own handwritten notes. Treated as a trusted second source, never saved
  as its own file. Direct contradictions with the transcript get surfaced in a
  "⚠️ Conflicts With Your Notes" section.
- **Multiple transcripts** (`src/lib/transcriptSources.js`) — two recordings of
  the same meeting (Teams + voice memo) are combined into one labeled document
  and reconciled into a single note; conflicts surface under "⚠️ Source
  Conflicts". A single source stays plain text, so the common path is
  unchanged. Speaker detection is disabled while multiple sources are loaded
  (it would re-segment both copies into a doubled transcript).
- **Speaker detection** (`/api/detect-speakers`, `src/lib/speakers.js`) —
  best-effort inference of speaker turns from conversational cues, since Apple
  dictation has no diarization. Always reviewed before it's applied.

On save: the note is written to the vault, CS-owned todos are appended to a
weekly `Todos/` file, and the SFDC section is appended to a weekly
`Reports/<monday> - SFDC Activity Report.md` (`/api/sfdc-report`).

## EA Activity: harvest, don't regenerate
The key idea. Notes saved through New Note already end with an SFDC entry the
user approved, so the tab **parses those rows verbatim** and only sends Claude
the notes that lack one (`src/lib/sfdcSection.js`). Harvested rows are free,
instant, and cannot be misattributed because no model rewrote them. When every
note is harvestable, no API call is made at all.

- **Cross-folder notes are never harvested.** They were pulled in only for
  mentioning an alias, so their SFDC entry may belong to another account. They
  go through generation, where the attribution rules apply. This is a load-
  bearing rule — removing it reintroduces silent account bleed.
- **Filed tracking** (`src/lib/filedRows.js`) — per-row "filed in SFDC",
  keyed on date+title so it survives regeneration.
- **Per-row regenerate** (`/api/regenerate-row`) — redo one row from its
  source, optionally told what to fix.
- **Few-shot** — previously approved rows from history are fed back as
  classification and voice examples. (`EA_Activity_Examples.txt` is a legacy
  empty template that nothing reads.)
- **Verify pass** (`/api/verify-rows`) audits only *generated* rows; harvested
  ones have no model claim to check.

## One SFDC taxonomy (`src/lib/sfdcTaxonomy.js`)
New Note and EA Activity write into the same Salesforce picklist, so both
render Type/Subtype from this one module using the spellings Salesforce shows
(`Escalation/Risk Management`, `QBRs/EBRs`, `SLE Governance`, `Demo Days`).
`normalizePair()` maps legacy spellings forward so old notes and history can't
reintroduce a bad value. `SFDC_VOICE_RULES` is shared too — both writers land
in the same Comment box, so they sound like the same person: past tense, no
first person but **no passive voice either** (subject-dropped fragments like
"Walked Gokul through the plan"), contractions fine, no corporate filler.

## Key architecture
- **Accounts & aliases** (`src/lib/accounts.js`): `DEFAULT_ACCOUNTS` maps each
  account to aliases, exclusion keywords, and EA/EP agreement numbers.
  `detectAccount()` resolves folder → account; `textHasAlias()` does whole-word
  matching; `suggestAgreements()` matches EA/EP numbers to a transcript by
  keyword.
- **Privacy** (`src/lib/sanitize.js`): `applyCorrections` → `applyReplacements`
  (real→alias) before sending, `reverseReplacements` on the way back. Word-
  boundary regex avoids alias collisions (ORG_1 vs ORG_12).
- **Bleed protection** (`src/lib/scrub.js`): other-account lines are scrubbed
  before sending, output is hard-redacted after, notes dominated by another
  account are auto-excluded, and the user can flag a bad row to teach the
  filter.
- **Durable config**: `/api/config` writes `notetaker-config.json` (accounts +
  corrections) and `notetaker-glossary.json` (replacements, sensitive) into the
  transcripts archive path. Settings also has manual export/import.
- **Transcript archive** (`/api/save-transcript`): saves to
  `<Transcripts Archive Path>/<account's Archive folder>/`. Both halves are
  editable in Settings.
- **Shared report workflow** (`src/hooks/useReportWorkflow.js`): scan → scrub →
  generate → verify → save, plus localStorage persistence, partial-output
  resume, and history. `handleSynthesize` takes `notesOverride` and `seedRaw`,
  which is how EA Activity sends only un-harvested notes.

## Synthesis (`src/app/api/synthesize/route.js`)
Streams via SSE. `buildSynthesisPrompt` (account), `buildProductPrompt`
(SystemLink), `buildCSMActivityPrompt` (EA Activity NDJSON rows). Model-aware
token budget: Sonnet 4.6 and Opus = 1M context, Haiku = 200k. Notes over budget
are map-reduce summarized rather than dropped. **Pick Sonnet for the most
coverage.**

## Settings (`src/components/SettingsPanel.jsx`)
Vault path, transcripts archive path, API key, model, glossary replacements,
common corrections, per-account editor (name / archive folder / aliases /
keywords / EA-EP numbers), keyword scanner, and config export/import. Vault
path must be the **plain** path — no shell escaping.

## Gotchas
- Container sessions have repeatedly reverted the checkout to an old commit.
  `origin/main` is the source of truth; fast-forward rather than re-doing work.
- `node_modules` disappears with those resets — `npm install` before testing.

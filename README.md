# BuildOffice AI

A virtual office run by AI agents, built for a construction contractor (also works as a general or family office).
Upload a PDF, photo, or text file, or type an instruction, and the agents read it, book it, remind you, and do the work.
**A human always verifies the numbers.** Agents can only propose; they never pay, delete, or send anything on their own.

> Indonesian documentation: [README.id.md](README.id.md). The interface ships in Indonesian and English (Settings → Language).

## What it does

- **Document intake.** PDFs, images, and text are read by an AI model and turned into structured data: type, parties, amounts, due dates, payment terms, and project progress. Invoices become open bills; receipts become draft cash entries.
- **Contractor mode.** Contracts, addenda, subcontracts, purchase orders, progress payments (terms), retention, guarantees, CAR policies, SBU certificates, site reports, safety (K3) reports, and lab tests are understood out of the box. Project health is computed from physical progress vs plan and cost vs progress (SPI / CPI).
- **Ten agents with real posts.** Receptionist, Document Reader, Archivist, Treasurer, Schedule Reminder, Project Manager, Daily Assistant, Report Writer, System Guardian, and General Staff. Each answers from its own data and tools, and says so when a question belongs to a colleague.
- **2.5D isometric office.** The agents walk around the rooms, talk, hold meetings, and react to what is happening. Rooms, rotation, and camera focus are built in.
- **Tasks and approvals.** Break a big instruction into tasks, let agents work on them, and review the results. Outgoing messages land in an approval box first.
- **Meetings and reports.** One click runs a team meeting from live data (minutes, decisions, follow-ups). Weekly reports, Word, Excel (with live formulas), and PDF files are generated on request.
- **Telegram (optional).** Reports, approvals with inline buttons, and a command bot.
- **Safe by design.** Settings are encrypted with Windows DPAPI, login is rate limited, uploaded text is treated as untrusted data, and figures an agent writes are checked against the source data.

## Quick start

Requirements: Node.js 18+ (tested on 24) and, for AI mode, an OpenAI or Anthropic API key. Without a key the app runs in demo mode.

```bash
npm install
# Windows: double-click start.bat (asks once for your key and accounts, encrypts them)
# any OS:
OPENAI_API_KEY=sk-... OFFICE_USERS="admin:a-strong-password|admin" BAHASA=en node server.js
```

Open http://127.0.0.1:3333 and sign in.

| Variable | Meaning |
|---|---|
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | AI provider key (`AI_PROVIDER` picks one if both are set) |
| `OFFICE_USERS` | `name:password\|role` pairs; roles are `admin`, `staf` (staff), `pengamat` (viewer) |
| `BAHASA` | `en` or `id` (default `id`); can also be set in Settings |
| `BIDANG` | Business type: `kontraktor` (contractor) or `umum` (general) |
| `MONTHLY_TOKEN_LIMIT` | Monthly AI token cap (default 2,000,000) |
| `PORT` / `HOST` | Defaults `3333` / `127.0.0.1`. Put it behind HTTPS before exposing it |

## Try it with sample data

`contoh-kontraktor/` holds 37 realistic documents for a fictional contractor (contracts, invoices, monthly progress reports, guarantees, tax receipts, and more) with matching numbers across four projects. Upload them in the Documents tab, or regenerate them from `contoh-kontraktor-sumber/` with `node contoh-kontraktor-sumber/buat.js`. All names and figures are fictional.

## How the language layer works

The source code is written in Indonesian. For other languages the UI text, API messages, and AI prompts are translated **at load time** from `lib/i18n/<lang>.json`, so there is one code base and one set of tests. The translatable strings are found with a JavaScript parser (`acorn`), and keys, comparisons, selectors, and data values are never touched. To add or refresh a translation:

```bash
node alat/bahasa-ekstrak.js    # list every UI string
node alat/bahasa-terjemah.js   # translate the missing ones with your configured AI provider
node tests/bahasa-test.js      # verify (identity, completeness, syntax, live server in id and en)
```

## Project layout

```
server.js            HTTP API, agents, scheduler, Telegram wiring
lib/                 documents, finance, projects, tasks, agents, tools, reports, language layer
public/              single-page UI (vanilla JS), 2.5D office renderer
alat/                translation tooling
tests/               language layer test
contoh-kontraktor*/  sample contractor documents and their generator
```

Data lives in `data/` (JSON files and uploads) on your own machine; only document contents you upload are sent to the AI provider.

## License

MIT

## Known limitations and next steps

Kept short on purpose: the first release focused on getting the interface into English quickly.

- **Stored content stays in its original language.** Meeting minutes and document summaries saved before switching to English are not translated; new ones are written in English.
- **Telegram commands** (`/tugas`, `/rapat`, `/setuju`, ...) are still Indonesian.
- **Translations are machine-generated** (reviewed on a sample, not line by line). Fixes go into `lib/i18n/en.json`; a `public/index.html::Word` key overrides a word for one file only.
- **Agent web tool (`AGEN_WEB=1`, off by default):** private-range blocking is in place, but the connection is not yet pinned to the resolved IP, so a DNS rebinding attack is theoretically possible. Leave it off on any exposed deployment until this is done.
- **Test coverage:** the language layer has its own test (`node tests/bahasa-test.js`); a full regression suite for the rest of the app still needs to be added to `tests/`.

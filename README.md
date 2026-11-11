# Prompt Sanitizer

Paste logs or a prompt on the left, get a copy on the right with personal data and secrets replaced by placeholders, then paste that into Claude, ChatGPT or any other LLM.

```
andi@web-prod-01:~$ psql "postgres://app:S3cr3t@db.maju.internal/orders"
```
becomes
```
[USER_1]@[HOST_1]:~$ psql "postgres://[USER_2]:[SECRET_1]@[HOST_2]/orders"
```

New here? Press **Guidance** in the top-right corner for a looping animated walkthrough with sound.

Everything runs in your browser. There is no backend, no database and no analytics, and the Content-Security-Policy forbids the page from making network requests at all.

## What it detects

| Placeholder | Detects | How |
|---|---|---|
| `EMAIL` | Email addresses | Pattern |
| `IPV4`, `IPV6` | IP addresses, including IPv4-mapped IPv6 | Pattern + range/structure validation |
| `MAC` | `aa:bb:…`, `AA-BB-…`, Cisco `aabb.ccdd.eeff` | Pattern |
| `HOST` | Hostnames in shell prompts, syslog lines, `host=` keys and single-label URL hosts; any name under a private suffix (`.internal`, `.local`, `.lan`, `.corp`, `.svc`, …); every domain on your blocklist and its subdomains | Context + private suffixes + your blocklist |
| `USER` | Users in shell prompts, `ssh user@`, sshd/sudo logs, `/home/<user>`, `C:\Users\<user>`, `username=` keys, URL credentials | Context |
| `SECRET` | `password=`/`api_key:`/`*_TOKEN=` values (JSON, YAML, env, CLI flags), Bearer/Basic auth, cookies, JWTs, AWS/GitHub/GitLab/Slack/Google/OpenAI/Anthropic/Stripe/npm keys, SQL `IDENTIFIED BY`, `.netrc`, bare random hex/base64 strings of 32+ characters (e.g. `openssl rand` output; hashes after `commit`/`sha256:`/`digest` are kept) | Context, known token formats, entropy |
| `PRIVATE_KEY` | Whole PEM private key blocks | Pattern |
| `PHONE` | `+62 812-…`, `0812-…`, `(415) 555-0132` | Pattern + dellt count |
| `CARD` | Payment card numbers | Pattern + Luhn checksum |
| `NATIONAL_ID` | Indonesian NIK and NPWP, US SSN | Pattern + structure validation |
| `LOCATION` | `Jl. …` / `221 Baker Street` addresses, `alamat:` values, GPS coordinates | Pattern + context |
| your label | Anything you list under **Settings → Your terms** | Case-insensitive; terms of 4+ characters also match inside words (`vmdellcli` → `vm[CLIENT_1]cli`) |

Public domains such as `github.com` are left readable unless you block them. System accounts (`root`, `admin`, `ubuntu`, …), `localhost` and placeholder values (`null`, `********`) are left alone too.

### Why no machine learning

Most of what leaks from logs (IPs, hostnames, credentials) is structured. Validated patterns with context cues catch it more reliably than general-purpose NER models, which are trained on prose. Company and client names, the part NER would help with, are better served by your own term list: you know exactly which names matter. Avoiding a model also keeps the app instant and free of a 100 MB+ download.

## How it stays accurate

1. **Validation, not just matching.** `999.1.1.1` is not an IP, a card number must pass Luhn, a NIK must contain a real date, and `version 1.2.3.4.5` stays untouched.
2. **Priorities.** When detections overlap, the stronger one wins: your terms, then blocked domains, private keys, credentials, emails, and so on down to addresses.
3. **Propagation.** A value found through context (a hostname from a syslog header, a password after `password=`) is redacted everywhere else it appears in the text, even where nothing marks it as sensitive.
4. **Consistent placeholders.** The same value always gets the same placeholder, so the model can still follow the story: `[HOST_1]` in line 3 is the same machine as `[HOST_1]` in your question.
5. **Fail closed.** When a rule is unsure, it redacts. Public domains are the exception: they are rarely sensitive on their own, so you opt in to hiding the ones that identify you.

The engine is a heuristic. Always look over the highlighted output before sending it.

## Settings

Open **Settings** to:

- **Your terms**: one per line as `LABEL: value`, e.g.
  ```
  COMPANY: PT Maju Jaya
  CLIENT: Globex Corporation
  CLIENT: Initech
  ```
  These become `[COMPANY_1]`, `[CLIENT_1]`, `[CLIENT_2]`. A line without a colon uses the label `CUSTOM`.
- **Domains to redact**: one domain per line, e.g. `maju.co.id`. Every subdomain (`api.maju.co.id`) is covered too. Pasted URLs and `*.` wildcards are normalized for you.
- **Detectors**: turn individual categories on or off.

Settings and the light/dark theme choice are saved to `localStorage` on your device. The text you paste is never stored.

## Development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev       # local dev server
npm run verify    # lint, type-check, unit tests, production build
```

| Script | Purpose |
|---|---|
| `npm run lint` | ESLint (typescript-eslint strict + eslint-plugin-svelte) |
| `npm run check` | `svelte-check` type-checking, warnings fail the run |
| `npm test` | Vitest unit tests for the engine, validators and settings |
| `npm run build` | Static production build into `dist/` |

### Project layout

```
src/
  App.svelte              Before/After workspace, header, theme toggle
  SettingsDialog.svelte   Terms, domain blocklist, detector toggles
  GuidanceDialog.svelte   Looping animated walkthrough with synced steps
  Mascot.svelte           The walking robot next to the title
  lib/
    rules.ts              Detection rules, priorities, categories
    validators.ts         IP, Luhn, NIK, SSN and other validators
    sanitize.ts           Matching, propagation, overlap resolution, placeholders
    sanitize.worker.ts    Runs the engine off the main thread
    settings.ts           Parsing and localStorage persistence
    highlight.ts          Fast DOM rendering for very large outputs
    sfx.ts                Guidance sound effects, synthesized with Web Audio (no audio files)
    theme.ts              Light/dark theme selection
```

To add a detector, add a rule to `RULES` in `src/lib/rules.ts`. Use a named capture group for the sensitive part (the group name is the placeholder label), and add tests covering both what it must catch and what it must leave alone.

## Deployment

The app is a static Vite build. On Vercel, `vercel.json` configures the build and sets security headers: a strict CSP (`default-src 'none'`, `connect-src 'none'`), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP/CORP and a restrictive Permissions-Policy.

```bash
vercel deploy --prod
```

## Security

CI runs lint, type-checking, tests, the build and `npm audit` on every push and pull request. CodeQL scans JavaScript/TypeScript and the workflows weekly, Dependabot keeps npm packages and pinned GitHub Actions current, and every action is pinned to a commit SHA. See [SECURITY.md](SECURITY.md) to report a vulnerability.

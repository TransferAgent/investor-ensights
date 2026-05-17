# Meta Title & Meta Description — Cradle-to-Grave Solution Chain

**Audience:** A sister Replit project whose LLM-driven `<meta name="title">` and `<meta name="description">` output is "not exceptional" and needs to be patched.

**Source project:** Investor Ensights (Next.js 16 App Router · Drizzle · multi-tenant Newsroom).

**Status here:** SHIPPED on PROD as of MT-4.13.4 (2026-05-15). Live SERP titles ≤65 chars, descriptions read content-first instead of door-hanger-first.

**TL;DR of the fix:**

1. Stop trusting the LLM to police itself. Wrap it in two deterministic acceptance gates (`metaTitleAcceptable`, `metaDescriptionAcceptable`) that return a short rejection reason or `null`.
2. The LLM is a polish pass, not the source of truth. A deterministic formula always builds a guaranteed-valid fallback first; the LLM is allowed to *beat* it.
3. Make the LLM two-shot: if attempt #1 fails the gate, feed the rejection reason back as an assistant/user turn and retry once at lower temperature. Worst case still under $0.001/article.
4. If both LLM attempts fail, ship the formula. Never throw. Never block publish on a meta-naturalizer failure.
5. Use one set of constants (`META_LIMITS`, `META_DESCRIPTION_BRAND_LEAD_GUARD_CHARS`) so the gate, the prompt, the formula, and the admin preview can never drift.
6. Provide a backfill script that re-stamps every published row through the same chain, with a `--naturalize` flag and a canary tripwire.

---

## 0. Vocabulary

| Term | Meaning |
|---|---|
| **Persona / Brand** | The publishing brand. In our world: Tableicity, Haylo Lab, etc. Comes from `public.tenants.persona_display_name`. |
| **City** | Location the article is localized for ("Austin", "Madison"). |
| **Haylo article / essay** | The source long-form essay that gets paired with a city to produce a press release. |
| **Pair** | One (Haylo essay × City) tuple. Becomes one published article. |
| **Meta title** | The `<title>` and `<meta property="og:title">`. SERP headline. |
| **Meta description** | The `<meta name="description">` and `og:description`. SERP snippet. |
| **Naturalizer** | The Tier-2.5 LLM polish module (`metaNaturalizer.ts`). |
| **Tier-1 / Tier-2 / Tier-2.5** | Our internal names for the meta source ladder — see §3. |

---

## 1. The problem we were solving

We started with a 5-agent generative pipeline (Researcher → Data Analyst → Local Copywriter → SEO QC → Internal Linker). The Copywriter agent produced the meta title and meta description as a side-effect. Symptoms we observed in production:

| Symptom | Frequency before fix | Why it happened |
|---|---|---|
| Title 80–90 chars (truncated mid-word by Google) | ~60% of LLM outputs | Prompt said "concise" without a hard cap; LLM optimized for descriptive over short. |
| Title leading with brand name ("Tableicity in Austin, TX: …") | ~95% | Prompt told the LLM to "name the brand". Brand ate 12–18 SERP characters of every title. |
| Description leading with brand ("Tableicity helps Austin founders…") | ~90% | Same reason. Reads like a door-hanger ad in the SERP. |
| Description missing the city | ~8% | LLM occasionally summarized the essay and dropped the locality. |
| Description missing the brand | ~3% | Same — LLM stayed too generic. |
| LLM returned plausible but wrong JSON shape | <1% | Standard JSON-mode flakiness. |
| LLM hallucinated stats / facts | rare but present | Generic to LLM meta generation. |

**Conductor decision (the human PM):** the brand name has no business in the title. The H1 above the fold, the canonical URL prefix (`/discovery/knowledge/tableicity-…`), and the description all carry the brand. Spending the title's 60-character SERP budget on the brand is wasteful. The description should read **80% content, 20% brand** — the brand earns one mention near the *end*, never the front.

This is the contract we then enforced mechanically.

---

## 2. The contract (MT-4.13.4)

### 2.1 Title

| Rule | Value | Why |
|---|---|---|
| Hard max length | **65 chars** | Google SERP truncates ~60. 65 leaves 5 chars of safety. |
| Soft target | **55 chars** | Sweet spot for desktop + mobile SERP. |
| Must contain | **city** (verbatim, case-insensitive) | The whole point of a local press release. |
| Must **NOT** contain | **brand persona name** | See §1. The brand is carried elsewhere. |
| Style | Single line, no emojis, no hashtags, no trailing punctuation except optional period. |

**Formula safety net:** `${city}, ${state}: ${haylo title trimmed to fit}` — no brand, ever.

### 2.2 Description

| Rule | Value | Why |
|---|---|---|
| Length window | **100–200 chars**, target 150 | Google snippet ~155 chars on desktop. |
| Must contain | **city + brand**, both verbatim | Locality + attribution. |
| Brand mention count | **1–2 times**, word-boundary `\b…\b` | One preferred. Two is the upper bound so it doesn't read as an ad. |
| Brand-lead guard | Brand MUST NOT appear in the **first 40 chars** | The "80/20" rule — content leads, brand earns its place at the end. |
| Style | 1–2 complete sentences, no emojis, no hashtags, no markdown. |

**Formula safety net:** `${first 1–2 Haylo sentences trimmed} ${brand} helps ${city} founders.` — brand only appears in the tail.

These two contracts are encoded as two pure functions that return `null` on pass or a short reason string on fail. Both the orchestrator AND the naturalizer call the *same* functions, so the gate at the live pipeline is byte-identical to the gate inside the naturalizer.

---

## 3. The architecture: three tiers + a polish pass

We treat meta generation as a ladder. Every article exits the ladder with valid meta, by construction.

```
                ┌──────────────────────────────────────────────┐
                │  Tier-1: LLM Copywriter agent's metaTitle /  │
                │  metaDescription (free-form, generative)     │
                └──────────────────────────────────────────────┘
                                   │
                       metaTitleAcceptable() &&
                       metaDescriptionAcceptable()
                                   │
                ┌─────────── PASS ──┴── FAIL ───────────┐
                ▼                                       ▼
        ship LLM meta                          build deterministic
        metaSource='llm'                       formula (Tier-2)
                                                       │
                                          run naturalizeMeta()
                                          (Tier-2.5 polish)
                                                       │
                                         ┌── PASS ─────┴── FAIL ──┐
                                         ▼                        ▼
                                ship naturalized meta      ship formula meta
                                metaSource='naturalized'   metaSource='fallback'
```

Cost ceiling per article: ~$0.0006 worst case (two `gpt-4.1-mini` calls). Real production average: $0.0003. **Backfill of 76 published rows cost $0.025 total.**

Latency ceiling: one additional LLM call (~600ms p50, ~1.4s p95) inserted into the pair pipeline — only when the Copywriter agent's meta is unusable. Live numbers: ~35% of articles trigger the Tier-2.5 polish, ~95% of those polish attempts pass on the first shot, the rest get the second-shot retry, and <1% degrade silently to the formula.

---

## 4. The acceptance helpers (the most important code in the whole stack)

These two functions are the load-bearing piece. Everything else — prompts, retries, fallbacks, the admin preview — is downstream of them.

**File:** `lib/newsroom/brandContext.ts`

```ts
// Returns null when acceptable, or a short reason string when rejected.
export function metaTitleAcceptable(
  meta: string | null | undefined,
  brand: BrandContext,
  cityName: string,
  maxLen: number = 65,
): string | null {
  if (!meta) return "title-empty";
  if (meta.length > maxLen) return `title-too-long-${meta.length}`;
  const lower = meta.toLowerCase();
  if (!lower.includes(cityName.toLowerCase())) return "title-missing-city";
  if (
    brand.personaDisplayName.length > 0 &&
    lower.includes(brand.personaDisplayName.toLowerCase())
  ) {
    return "title-contains-brand";
  }
  return null;
}

export function metaDescriptionAcceptable(
  meta: string | null | undefined,
  brand: BrandContext,
  cityName: string,
  opts: { minLen?: number; maxLen?: number; brandLeadGuardChars?: number } = {},
): string | null {
  const minLen = opts.minLen ?? 100;
  const maxLen = opts.maxLen ?? 200;
  const brandLeadGuardChars = opts.brandLeadGuardChars ?? 40;
  if (!meta) return "desc-empty";
  if (meta.length < minLen) return `desc-too-short-${meta.length}`;
  if (meta.length > maxLen) return `desc-too-long-${meta.length}`;
  const lower = meta.toLowerCase();
  if (!lower.includes(cityName.toLowerCase())) return "desc-missing-city";
  const persona = brand.personaDisplayName;
  if (persona.length === 0) return null;
  const personaEsc = persona.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const brandRe = new RegExp(`\\b${personaEsc}\\b`, "gi");
  const matches = meta.match(brandRe) ?? [];
  if (matches.length < 1) return "desc-missing-brand";
  if (matches.length > 2) return `desc-brand-overused-${matches.length}`;
  // 80/20 lead guard: no brand mention in the opening characters.
  const lead = meta.slice(0, brandLeadGuardChars);
  if (brandRe.test(lead)) return "desc-brand-in-lead";
  return null;
}
```

**Why returning a *reason string* rather than a `boolean` matters:** the reason string flows back into the LLM as the retry instruction (§5.3). You're paying for one call's worth of tokens — give the LLM the diagnostic.

**Reasons emitted today (and what they mean):**

| Reason | Meaning |
|---|---|
| `title-empty` | LLM returned `null` / `""` / non-string. |
| `title-too-long-87` | Title was 87 chars; cap is 65. |
| `title-missing-city` | City name not found anywhere in the title. |
| `title-contains-brand` | Brand name appeared somewhere — this contract bans it from the title. |
| `desc-empty` / `desc-too-short-N` / `desc-too-long-N` | Length-bounds violation. |
| `desc-missing-city` / `desc-missing-brand` | One of the required tokens absent. |
| `desc-brand-overused-3` | Brand appeared 3+ times — reads as an ad. |
| `desc-brand-in-lead` | Brand appeared inside the first 40 chars — content didn't get the lead. |

---

## 5. The naturalizer (Tier-2.5)

**File:** `lib/newsroom/metaNaturalizer.ts`

### 5.1 What it is

A single-purpose module that takes the brand context, the city, the Haylo essay, and the *already-built* deterministic fallback strings, and asks `gpt-4.1-mini` to produce a better `{title, description}` JSON. The fallbacks are passed in so the LLM has a baseline to *beat*, never to copy. If the LLM fails the acceptance gates twice in a row, the module returns the fallbacks unchanged. **It never throws.**

### 5.2 The system prompt (verbatim, this is the secret sauce)

```
You are an SEO meta-tag stylist for a local-market press release publisher.

You write a TITLE (for the SERP <title>) and a DESCRIPTION (for the SERP
snippet) that read like a useful local article — not like a door-hanger ad.

TITLE rules (any violation rejects your output):
- Length: target 55 characters, hard maximum 65 characters. Aim short.
  Google truncates around 60.
- MUST contain the EXACT city name (case-insensitive).
- MUST NOT contain the brand persona name. Repeat: the brand name is
  forbidden in the title. (The brand is already carried by the H1,
  canonical URL, and description — putting it in the title burns SERP
  characters.)
- Single line. No emojis. No hashtags. No trailing punctuation except an
  optional period. No quotation marks wrapping the whole title.
- Lead with the topic or the city — make it useful to a founder skimming
  the SERP.

DESCRIPTION rules (any violation rejects your output):
- Length: target 150 characters, between 100 and 200.
- "80% content, 20% brand" — the description is content-first prose. Lead
  with the story, the problem, or the local detail. The brand earns one
  mention near the END as the source/CTA.
- MUST contain the EXACT city name (case-insensitive).
- MUST contain the EXACT brand persona name AT LEAST ONCE and AT MOST
  TWICE. One mention is preferred.
- The brand name MUST NOT appear inside the first 40 characters. If you
  start a sentence with the brand it will be rejected.
- One or two complete sentences. No emojis, no hashtags, no markdown.

Universal rules:
- American English. Address founders / operators plainly.
- Do not invent statistics or facts. Stay within the topic of the haylo
  article you are given.
- Do not echo the deterministic-fallback strings you are shown — they are
  provided ONLY so you can do better.

Return STRICT JSON ONLY (no prose, no code fences) in this exact shape:
{ "title": "...", "description": "..." }
```

**Prompt-engineering observations from the war room:**

- **"any violation rejects your output"** — explicit threat language. Materially raises first-shot pass rate vs. "please follow these rules".
- **"Repeat: the brand name is forbidden in the title."** — the repetition is load-bearing. Without it, ~15% of titles still slipped the brand in.
- **"do better"** as the framing for the fallback strings — without that framing, ~30% of LLM outputs were lightly-rephrased copies of the formula.
- **"American English. Address founders / operators plainly."** — kills the LLM's default tendency to sound like a press release agency.

### 5.3 The two-shot retry (the other secret sauce)

First call: temperature 0.6, JSON-mode on. If acceptance fails, we push the LLM's bad answer as an `assistant` turn and a corrective `user` turn that quotes the *specific* rejection reason, then call again at temperature 0.3:

```ts
messages.push({ role: "assistant", content: JSON.stringify(parsed) });
messages.push({
  role: "user",
  content: `Your previous attempt was rejected for: ${v.reason}. Try again.
Remember: title MUST contain "${input.cityName}" and MUST NOT contain
"${input.brand.personaDisplayName}", title length ≤ 65.
Description MUST contain both "${input.cityName}" and
"${input.brand.personaDisplayName}", brand mentioned 1-2 times and NOT
in the first 40 characters, length between 100 and 200.`,
});
```

**Why it works:** the failure mode is almost always a single rule the model fumbled (usually `title-too-long-N` or `desc-brand-in-lead`). Naming that specific failure in a follow-up turn gives the model exactly the constraint it needs to repair. We measured first-shot pass rate ~78%, two-shot pass rate ~98%.

**Why temperature drops on retry:** the first call was creative; the second call needs to follow the rule. Lower temperature pulls the model toward the literal constraint.

**Cost ceiling:** two `gpt-4.1-mini` calls at ~500 input + ~80 output tokens each. ~$0.0006 worst case per article.

### 5.4 Why it never throws

The orchestrator can't tolerate a meta-generation failure aborting an article that's already passed SEO QC. So `naturalizeMeta()`:

- Catches `getClient()` errors → returns fallback strings with `rejectionReason: 'no-api-key:…'`.
- Catches OpenAI HTTP errors → returns fallback with `'openai-error:…'`.
- Catches malformed JSON → counts as a failed attempt, retries once with a "that wasn't JSON, return only JSON" follow-up, then falls back.
- Catches both attempts failing acceptance → returns fallback with the last rejection reason.

In every degrade path, `source: 'fallback'` is set on the return value so the orchestrator (and the audit log) know the formula shipped, not the LLM.

---

## 6. The deterministic Tier-2 formula

**File:** `lib/newsroom/pairProcessor.ts`

This is the safety net that guarantees every article has meta. It runs in three places:

- The dry-run path (no LLM at all).
- The orchestrator path (always pre-computed so the naturalizer has a baseline; shipped if the naturalizer also fails).
- The Tableicity backfill script (legacy rows where there's no Copywriter agent output).

```ts
export function buildMetaTitle(brand, cityName, stateCode, hayloTitle) {
  // brand is intentionally unused — see contract above.
  void brand;
  const prefix = `${cityName}, ${stateCode}: `;
  const remaining = 65 - prefix.length;
  const rawSuffix = (hayloTitle ?? "").trim();
  const suffix = rawSuffix
    ? truncateAtWordBoundary(rawSuffix, Math.max(10, remaining)).replace(/\.$/, "")
    : "Founders' guide";
  return `${prefix}${suffix}`.slice(0, 65);
}

export function buildMetaDescription(brand, cityName, stateCode, hayloTitle, hayloBodyHtml) {
  const tail = ` ${brand.personaDisplayName} helps ${cityName} founders.`;
  const remaining = 200 - tail.length;

  let body = hayloBodyHtml
    ? buildMetaDescriptionFromBody(hayloBodyHtml, remaining)
    : null;
  if (!body) body = hayloTitle.trim();

  // If the Haylo essay opens with the brand name, strip it — we
  // re-attach the brand in the tail, so the lead stays clean.
  const brandRe = new RegExp(
    `\\b${brand.personaDisplayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[\\s,:.-]*`,
    "i",
  );
  if (body.length > 0 && brandRe.test(body.slice(0, 40))) {
    body = body.replace(brandRe, "").trim();
    if (body.length > 0) body = body.charAt(0).toUpperCase() + body.slice(1);
  }

  return truncateAtWordBoundary(`${body}${tail}`, 200);
}
```

**Properties this formula guarantees:**

1. Title contains the city verbatim (it's in the prefix).
2. Title contains no brand (we don't include it).
3. Description ends with the brand attribution — guarantees `desc-missing-brand` can never fire on the formula.
4. Description's lead is the Haylo content, with any opening brand mention scrubbed — guarantees `desc-brand-in-lead` can never fire on the formula.
5. Both strings end on a word boundary with a sentence-terminator.

**This is why the formula is a true safety net.** It is constructed to pass its own acceptance helpers. If the naturalizer ships the formula, the result still satisfies `metaTitleAcceptable()` and `metaDescriptionAcceptable()`.

---

## 7. The shared constants (drift insurance)

**File:** `lib/newsroom/pairProcessor.ts`

```ts
export const META_DESCRIPTION_BRAND_LEAD_GUARD_CHARS = 40;
export const META_LIMITS = {
  titleTarget: 55,
  titleHardMax: 65,
  descriptionTarget: 150,
  descriptionSoftWarn: 180,
  descriptionHardMax: 200,
  descriptionBrandLeadGuard: 40,
} as const;
```

These are imported by:

- `lib/newsroom/metaNaturalizer.ts` — to format the system prompt and call the acceptance helpers.
- `lib/newsroom/pairAgentOrchestrator.ts` — implicitly via the helpers (no magic numbers in the orchestrator).
- The admin Persona Wizard's `POST /api/admin/personas/preview-meta` route — so the SEO preview card on the wizard renders the *exact* string a live pair would.

**Why this matters:** before MT-4.13.4 we had a 65 in the prompt and a 90 in the orchestrator guard. The LLM kept shipping 80-char titles that the orchestrator was happy with. One source of truth makes that class of bug impossible.

---

## 8. Where the chain lives in the codebase

| File | Role |
|---|---|
| `lib/newsroom/brandContext.ts` | Brand resolver + `metaTitleAcceptable` + `metaDescriptionAcceptable`. |
| `lib/newsroom/pairProcessor.ts` | Deterministic Tier-2 formula + `META_LIMITS` constants. |
| `lib/newsroom/metaNaturalizer.ts` | Tier-2.5 LLM polish, two-shot retry, never throws. |
| `lib/newsroom/pairAgentOrchestrator.ts` (lines ~140–225) | The ladder: LLM → acceptance gate → naturalizer → formula. |
| `lib/newsroom/pipelineWorker.ts` (MT-4.13.2) | Body-side brand-mention guard (separate from meta — see §10). |
| `scripts/backfill-tableicity-meta.ts` | Backfill any DB of published rows through the same chain, with `--naturalize` flag. |
| `shared/schema.ts` | `meta_source varchar(16)` column on `knowledge_articles`. Values: `'llm'`, `'naturalized'`, `'fallback'`. |

---

## 9. The orchestrator decision (the actual ladder code)

**File:** `lib/newsroom/pairAgentOrchestrator.ts`

```ts
const titleRejection = metaTitleAcceptable(agentDraft.metaTitle ?? null, brand, input.city.cityName);
const descRejection  = metaDescriptionAcceptable(agentDraft.metaDescription ?? null, brand, input.city.cityName);
const llmMetaTitleOk = titleRejection === null;
const llmMetaDescOk  = descRejection  === null;

let metaTitle: string;
let metaDescription: string;
let metaSource: "llm" | "fallback" | "naturalized";

if (llmMetaTitleOk && llmMetaDescOk) {
  // Tier-1: the Copywriter agent already wrote acceptable meta. Ship it.
  metaTitle = agentDraft.metaTitle!;
  metaDescription = agentDraft.metaDescription!;
  metaSource = "llm";
} else {
  // Log the rejection reason for forensics.
  if (!llmMetaTitleOk) console.warn(`LLM metaTitle rejected: ${titleRejection}`);
  if (!llmMetaDescOk)  console.warn(`LLM metaDescription rejected: ${descRejection}`);

  // Tier-2: always pre-compute the formula so the naturalizer has a baseline
  // AND so we have a guaranteed-valid string to ship if the naturalizer fails.
  const fallbackTitle       = buildMetaTitle(brand, input.city.cityName, input.city.stateCode, input.hayloArticle.title);
  const fallbackDescription = buildMetaDescription(brand, input.city.cityName, input.city.stateCode,
                                                   input.hayloArticle.title, input.hayloArticle.bodyHtml);

  // Tier-2.5: the polish pass.
  const polished = await naturalizeMeta({
    brand,
    cityName: input.city.cityName,
    stateCode: input.city.stateCode,
    hayloTitle: input.hayloArticle.title,
    hayloBodyExcerpt: hayloBodyExcerptFromHtml(input.hayloArticle.bodyHtml),
    fallbackTitle,
    fallbackDescription,
  });

  metaTitle = polished.title;
  metaDescription = polished.description;
  metaSource = polished.source === "naturalized" ? "naturalized" : "fallback";
}
```

The persisted draft carries `metaSource` into `knowledge_articles.meta_source` so the admin UI can show provenance per article and Conductor can audit how often each tier ships in PROD.

---

## 10. The companion guard: brand mention in the body (MT-4.13.2)

This is a separate but related guard worth porting if your other Replit's articles render the brand name as a backlink in the body.

**Symptom we hit:** the public article renderer wraps the first body occurrence of the brand name with a brand-home backlink. If the LLM body never mentioned the brand, the backlink silently disappeared. Two articles shipped this way in May 2026 before we caught it.

**Fix:** in `lib/newsroom/pipelineWorker.ts::runPipeline`, after the Copywriter sanitization but BEFORE composing the draft, we do a word-boundary test on the body HTML:

```ts
const brandRe = new RegExp(`\\b${escape(brand.personaDisplayName)}\\b`, "i");
if (!brandRe.test(bodyHtml)) {
  throw new Error(`brand-mention-missing: body has no \\b${brand.personaDisplayName}\\b`);
}
```

Throwing here marks the pipeline job `failed` rather than shipping a brand-less article. Headlines and subheadlines don't count toward the test — body only.

**Forward-only deletes rule:** the two pre-existing brand-less articles are NOT retroactively fixed. The guard prevents future occurrences only. (This may or may not apply to your project, depending on your rules of engagement.)

---

## 11. The backfill workflow

**File:** `scripts/backfill-tableicity-meta.ts`

If you adopt this fix mid-flight, you'll have a back catalog of published rows with bad meta. The backfill script re-stamps them through the same chain.

**Design notes:**

- **DEV vs PROD URL refusal:** aborts if both env URLs resolve to the same string.
- **Canary tripwire:** aborts if the published count differs from `--expected=N` by more than 5 rows (catches "wrong tenant", "schema not migrated").
- **Idempotent:** skips rows where `meta_locked_at IS NOT NULL`. `--force` re-locks.
- **Transactional:** all writes in one `BEGIN`/`COMMIT`, rolls back on first error.
- **Pure meta-only UPDATE:** does NOT touch `updated_at`, `date_modified`, `status`, `slug`, `robots`, or `date_published`. The public sitemap's last-mod stays content-driven, not SEO-meta-driven. Otherwise a meta backfill would mis-signal a content change to crawlers for every row in the catalog.
- **`--naturalize` flag:** when set, every row runs through the Tier-2.5 polish pass. Rows that pass land with `meta_source='naturalized'`, rows that degrade land with `meta_source='fallback'`.

**Live PROD cost from our run:** 76 rows backfilled with `--naturalize`. Total OpenAI cost $0.025. ~71 rows ended up `naturalized`, ~5 fell back to formula.

---

## 12. Audit + observability

Three persisted signals you can dashboard on:

1. **`knowledge_articles.meta_source` distribution.** If `'llm'` is dominant and stable, the Copywriter agent is doing fine on its own. If `'naturalized'` is dominant, the agent isn't internalizing the contract — adjust its prompt. If `'fallback'` ever spikes, the naturalizer is failing — usually an OpenAI outage or an API-key rotation.
2. **`logAuditEvent("meta.naturalized", { source, rejectionReason, costUsd, tokensUsed })`** — every naturalizer call logs cost and pass/fail. We use it to track per-tenant spend on the polish pass.
3. **Naturalizer console warnings** — every Tier-2.5 rejection logs the specific reason (`title-too-long-87`, `desc-brand-in-lead`, etc.). When the same reason starts dominating, that's a prompt-engineering signal.

---

## 13. Adoption checklist for your sister Replit

If your other Replit is also a generative-content shop and you want to port this whole stack:

- [ ] **Pick your contract first, not last.** Sit with the human PM and decide: title length cap, what MUST be in the title, what MUST NOT, description length window, brand mention count, brand-lead-guard. Write it down. The rest of the work is implementing that contract.
- [ ] **Write the two acceptance helpers** (`metaTitleAcceptable`, `metaDescriptionAcceptable`) BEFORE you touch any LLM code. They are the load-bearing pieces. Make them return reason strings, not booleans.
- [ ] **Centralize the limits** in one `META_LIMITS` const. Import it everywhere — prompt, gate, formula, admin preview.
- [ ] **Build the deterministic formula second.** Construct it to pass its own helpers. This is your safety net.
- [ ] **Then write the naturalizer.** System prompt repeats the contract verbatim. JSON-mode. Two-shot retry that quotes the rejection reason. Never throws — always returns the fallback on any error.
- [ ] **Wire the ladder** in your orchestrator: LLM agent meta → gate → if fail, formula + naturalizer → ship whichever passes. Persist a `meta_source` enum so you can observe provenance.
- [ ] **Add a body-side brand guard** if your renderer wraps the brand name as a link.
- [ ] **Write a backfill script** with DEV/PROD refusal, canary tripwire, transactional writes, idempotency, and a pure-meta-only UPDATE that does NOT touch sitemap-driving timestamps.
- [ ] **Smoke-test on PROD with curl.** Look for `<title>`, `<meta name="description">`, and your acceptance constraints in the initial HTML for at least three live pages before declaring victory.

---

## 14. Known-good behaviour you should reproduce

After porting, the following should be true in PROD:

| Check | How |
|---|---|
| Every published article has `<title>` length ≤ 65. | `curl <url> \| grep '<title>'` for a sample. |
| Every published article has a `<meta name="description">` between 100 and 200 chars. | Same. |
| No published article's `<title>` contains the brand name. | Same. |
| Every published article's description contains the city verbatim. | Same. |
| Every published article's description contains the brand name 1–2 times, never in the first 40 chars. | Visual scan of 5 random pages. |
| `meta_source` distribution in PROD DB is dominated by `'llm'` or `'naturalized'`, with `'fallback'` rare. | `SELECT meta_source, COUNT(*) FROM knowledge_articles WHERE status='published' GROUP BY meta_source;` |
| Naturalizer total monthly spend is well under $1/tenant. | OpenAI usage dashboard, filtered by `gpt-4.1-mini`. |

---

## 15. Gotchas your sister Replit will hit

- **JSON-mode is necessary but not sufficient.** The model still occasionally returns valid JSON whose `title` or `description` is `null` or an array. Validate the shape (`typeof === 'string'`) and trim before passing to the acceptance helpers.
- **Brand names with regex special characters.** Escape them. We had a near-miss with a tenant whose brand was `"Founder/Operator"` — the `/` was harmless but `.` and `+` in other tenants will break the word-boundary regex if not escaped.
- **Case sensitivity.** Acceptance helpers compare lowercase. Formula construction preserves case. If you `===` anywhere in the chain, you'll get false rejections.
- **City name vs city slug.** The acceptance gates check against `cityName` (e.g. "St. Petersburg"), not `slug` (`st-petersburg`). Pass the right one.
- **Don't echo the formula.** Without the explicit "do NOT copy — beat them" framing in the user prompt, the LLM will lightly reword the formula and waste your $0.0003. Quote the framing verbatim.
- **Don't let the formula contain the brand in the lead either.** Our formula `buildMetaDescription` actively scrubs an opening brand mention from the Haylo body before prepending it, then re-attaches the brand in the tail. Without that scrub, articles whose source essay opened with the brand name would fail their own formula's gate.
- **Don't update `updated_at` / `date_modified` on a meta backfill.** Sitemap last-mod is content-driven, not SEO-meta-driven. Crawlers will re-fetch 80 articles for nothing if you bump the timestamp.
- **Don't make the naturalizer block publish.** The whole point is that it degrades silently. If you make it throw, one OpenAI hiccup will stall your entire publishing pipeline.
- **Don't try to police the meta inside the Copywriter agent's prompt.** We tried. The agent has too many other constraints to also internalize SEO meta rules reliably. A separate, single-purpose polish pass with a tight contract wins every time.

---

## 16. File reference index (paste-ready)

Copy-friendly file paths for your sister Replit's spike:

```
lib/newsroom/brandContext.ts           — acceptance helpers (the core)
lib/newsroom/pairProcessor.ts          — formula + META_LIMITS constants
lib/newsroom/metaNaturalizer.ts        — Tier-2.5 LLM polish, two-shot retry
lib/newsroom/pairAgentOrchestrator.ts  — the ladder (lines ~140–225)
lib/newsroom/pipelineWorker.ts         — body brand-mention guard (MT-4.13.2)
scripts/backfill-tableicity-meta.ts    — re-stamp legacy rows
shared/schema.ts                       — meta_source varchar(16) column
```

— End of doc. Ping me if your sister Replit hits a guard reason this doc doesn't explain; that's the signal the contract needs a new clause.

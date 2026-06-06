---
name: Article meta wiring (change-in-lockstep)
description: The article meta title/description contract is defined and enforced in several places that MUST be edited together; lists every site so a band/rule change doesn't half-land.
---

# Article meta — change-in-lockstep map

The **Article** meta path (Newsroom press releases) is separate from the **City** meta path. Changing an article band or rule means touching ALL of these or the change half-lands:

- **Two duplicated constant sets** (no shared import between them):
  - `lib/newsroom/metaNaturalizer.ts` local consts (drive LLM generation + the naturalizer's own validation).
  - `lib/newsroom/pairProcessor.ts` `META_LIMITS` (drive the deterministic fallback builders + admin preview + the orchestrator Tier-1 gate).
  Set both to the same numbers.

- **Two gates** (must stay identical, both call the shared validators in `brandContext.ts`):
  - Orchestrator **Tier-1** gate in `pairAgentOrchestrator.ts` (validates the copywriter's meta; if it rejects, routes to the naturalizer).
  - Naturalizer **Tier-2.5** `validateOrNull` in `metaNaturalizer.ts`.
  Note: if Tier-1's band is looser than the target, a short copywriter description ships as `meta_source='llm'` and the naturalizer never runs — so Tier-1 must enforce the SAME band you want.

- **Two excerpt call sites** for the Haylo grounding slice (`hayloBodyExcerptFromHtml(bodyHtml, N)`):
  - live: `pairAgentOrchestrator.ts`
  - backfill: `scripts/backfill-tableicity-meta.ts` (`--naturalize`)
  The helper default is separate; the City truth-doc generator passes its own value.

- **Prompt + retry + fallback** (for any title/description rule, not just length):
  - naturalizer **system prompt** rules,
  - naturalizer **two-shot retry hint**,
  - deterministic **fallback** `buildMetaTitle` / `buildMetaDescription` in `pairProcessor.ts` (the safety net must obey the rule too, e.g. the title fallback prefix).

**State-ban guard quirk:** the shared `metaTitleAcceptable` takes an OPTIONAL `stateCode`; the article path passes it, the City wrapper (`cityMetaContract.ts`) does its OWN state check and does NOT pass it through — so adding the param doesn't change City behavior. The match is **case-sensitive on the UPPERCASE code** (`\bXX\b`) — deliberate, to avoid false-positives on lowercase words ("or", "in", "me"). Tradeoff: a lowercase code (`Albany, ny`) would slip through, but real titles are Title-Case so this is an accepted parity decision (same as the City path the Conductor already approved).

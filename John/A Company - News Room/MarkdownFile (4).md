Part 1 — Is the handoff package ready for the Architect + 5 Engineers?

**Short answer: yes for the Architect, mostly yes for 4 of the 5 Engineers, and there's one gap that will burn an Engineer-day if you don't close it before kickoff.**

What's solid in Newsroom\_Worker\_Contract.md

*   **Auth model is unambiguous.** Single shared header, 403 on miss. Engineers will not invent their own scheme.
*   **The loop is spelled out with line-numbered ordering** (claim → stage → heartbeat → run → knowledge → review → complete). An Engineer can copy it into their Python while True skeleton on Day 1.
*   **Lease/heartbeat semantics are now bulletproof** — the 5-min stale rule + the new HTTP 409 "lease lost" response means two Engineers running workers in parallel can't corrupt each other.
*   **Dry-run flag is documented.** Critical — it lets you point all 5 Engineers at prod without spending a dollar on Anthropic during shakeout.
*   **Draft payload v1 is frozen in Zod** (lib/newsroom/draftPayload.ts) and the JSON example in the doc matches it. The Copywriter Engineer can stub fixture data for the Architect to wire end-to-end without LLM calls.
*   **Direct DB access is permitted** with the table list. Architect can decide which writes go via API vs. direct INSERT for throughput. Gemini's CrewAI snippet assumes direct DB; the contract supports that.
*   **Roles match Gemini's 4 agents 1:1** (researcher / data\_analyst / copywriter / seo\_qc) plus our bonus internal\_linker. No naming reconciliation needed.

The one gap that will bite

**The Researcher Engineer has no contract for _where_ to put raw scraped HTML before the Analyst sees it.** The doc mentions newsroom\_source\_documents table with a content\_hash column but never shows the shape of a row, and there's no POST /api/newsroom/worker/source-documents endpoint listed. Gemini's whole pitch ("Crawl4AI dumps clean Markdown into the pipeline, Analyst pulls from there") assumes that table is a first-class write target.

**Fix before Engineer kickoff:** spend 30 min documenting the source-documents row shape (url, fetched\_at, content\_md, content\_hash, citySlug, sourceDomain) and either add a worker endpoint or explicitly say "write directly to Postgres, here's the schema." Without it, Researcher and Analyst Engineers will invent two incompatible formats.

Smaller paper-cuts worth fixing in 15 min total

*   **No retry/backoff guidance.** What does an Engineer do if /review returns 500? The doc should say "retry with the same idempotency key, on duplicate slug regenerate the suggestedSlug suffix." Otherwise you'll get duplicate articles on a transient failure.
*   **No agent-config-fetch instruction.** The contract says "Fetch the canonical agent UUIDs at startup" but doesn't mention the Engineer should also pull systemPrompt and sources from newsroom\_agents — yet that's exactly the pipe we built in Phase 2. Add one line: "Workers SHOULD reload systemPrompt and sources per job to honor admin edits without restart."
*   **Missing the lead\_signals write contract.** Same issue as source-documents — table exists, Gemini's Tier-1/Tier-2/Tier-3 scoring writes here, but no shape doc.
*   **No mention of pgvector setup ownership.** Doc says "purely a worker-side concern" — fine, but the Architect needs to know whether _they_ own running CREATE EXTENSION pgvector on prod or whether you'll do it. Cite who.

If you patch those four nits + the source-documents gap, 5 Engineers can pick up the doc cold and start coding without Slack pings to you.

Part 2 — Post-POC features Gemini's notes will demand

I'm splitting these by "build it before you turn noindex off" vs. "build it once articles are actually live" because the order matters for Google trust.

Tier A — Must add **before flipping articles to index, follow**

These are non-negotiable from a "Google won't penalize us" standpoint per Gemini.

1.  **Cross-city similarity gate (Jaccard < 0.35).** Gemini hammers this — it's the single feature that prevents a manual action for "scaled content abuse" across 350 pages. The seo\_qc agent role exists in our schema, but there's no API endpoint that, at publish time, compares the candidate article's bodyHtml against the last N published articles and _blocks publish_ if similarity > 0.35. Right now QC is advisory. Need to make it a hard gate.
2.  **Per-city internal-link variance enforcement.** Gemini's "Worcester→Vesting, Boston→409A" rule. Our newsroom\_internal\_link\_suggestions table stores them, but nothing prevents the Copywriter from sending every article to /scenario-modeling. Need a "diversity check" — reject draft if the proposed targetSlug matches >40% of recently published articles' link targets.
3.  **H1 randomizer.** Gemini calls this out by name ("Variance Script: 3 H1 structures per city"). Easy add — store 3 templates per agent in newsroom\_agents, copywriter rotates. Without it, every Worcester article will start "Cap Table Management for Worcester" and Google's pattern detector will eat us.
4.  **Real publisher Organization profile + logo.** I flagged this in my last message; Gemini reinforces it because their JSON-LD recommendations require a real Organization block for E-E-A-T. Currently a placeholder.

Tier B — Add within 30 days of going live

These turn the Newsroom from "publisher" into "self-optimizing engine," which is Gemini's whole closing pitch.

1.  **Google Search Console feedback loop** (the script from lines 750–810). Pull clicks/impressions/position per URL daily, store in a new knowledge\_article\_metrics table. Without this you have zero idea which cities are working.
2.  **Auto-rewrite trigger for low-CTR pages** (the script from lines 815–890). Once GSC data is in, an admin button or scheduled job that flags articles with high impressions + CTR <2% and re-enqueues them through the Copywriter with the actual GSC queries as input. This is the "healing" loop and it's where the real ROI is.
3.  **Slack/Discord webhook for publish + heal events.** Gemini mentions this twice. Trivial — one new env var (SLACK\_WEBHOOK\_URL) and a lib/notify.ts helper, fire from the publish route and the audit log. Big morale win during the 5-day rollout.
4.  **Lead Magnet capture on city pages** (the "MA Founder's Equity Checklist" thread, lines 451–490). Currently /locations/\[slug\] has the login panel on the right but no email capture. Gemini wants exit-intent + delivery + CRM hook. Whole new feature: form route, email service integration, PDF asset.

Tier C — "Nice signals" Gemini mentioned, lower urgency

1.  **Crunchbase/SEC enrichment of lead\_signals.** Gemini's Tier-1/Tier-90+ scoring (lines 144–148). Worker-side concern, but our schema is ready.
2.  **Vector memory in newsroom\_agent\_knowledge via pgvector.** Stops the AI from repeating the same Worcester facts twice. Worker-owned per the contract, but you'll want it before article #50 per city.
3.  **Lighthouse-CI gate on every published article.** Gemini's CWV checklist (lines 1011–1014: LCP <2.5s, INP <200ms). Could be a GitHub Action against the deployed URL.
4.  **Cache-Control: no-cache for 24h on freshly updated pages** (line 430) — currently we just rely on Next.js defaults.

What I'd do if I were you

Before the Architect kicks off:

*   **Spend 1 hour with me** patching the 5 contract gaps (source-documents row shape, lead\_signals row shape, retry/backoff, agent-config reload note, pgvector ownership). I can do all 5 in one pass — say the word and I'll knock them out.

Before the Engineers ship the first **live** (non-dry-run) article:

*   **Build Tier A items 1, 2, and 4.** Item 3 (H1 randomizer) can go in via the agent config form we just shipped — no new code on our side, the Copywriter Engineer just needs to know to rotate.

Once the first 10 cities are live:

*   **Build Tier B items 5 and 6 immediately** — the GSC loop is what makes this whole project worth the LLM spend. Without it you're scaling content blind.

Want me to patch the contract gaps right now so the Architect gets a clean handoff doc?
---
name: Cities and Articles are separate domains
description: Conductor guardrail — never describe Cities as being or becoming Articles; they are distinct logic/function.
---

Cities and Articles are two **separate** domains ("different planets" — Conductor's words). Do not conflate them or call anything a "city article."

- **Cities** = dynamic city landing pages (`app/locations/[slug]`) with their own data, slideshows, contact/maps, and their own per-city SEO meta (the city-meta generator + Truth Document flow). The Truth Document (`tenants.default_haylo_article_id`) feeds **city meta**, nothing else.
- **Articles** = SEO knowledge press releases (`app/discovery/knowledge/[slug]`), produced by the newsroom 5-agent pipeline.

**Why:** The Conductor explicitly corrected the framing. The newsroom scheduler *pairs* a Haylo essay with a city's local-market grounding to generate an **article** — the city is a grounding **input/dimension**, never the output. A city is not an article and never becomes one.

**How to apply:** When discussing the scheduler or publishing, say the pipeline uses a city as grounding to produce an article; never say cities "turn into" or "are" articles. Keep city-page work and article work described as separate systems.

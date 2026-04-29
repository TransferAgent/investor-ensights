/**
 * Regression tests for the Halo HTML format integration.
 *
 * Run from project root:
 *   npx tsx scripts/test-halo-sanitizer.ts
 *
 * Asserts the contracts the architect review flagged:
 *   1. normalizeHayloBody strips the first <h1> (page renders headline from a
 *      dedicated DB column, so a body-level <h1> would duplicate the title).
 *   2. normalizeHayloBody preserves <strong> by default (Halo confirmed in
 *      writing that <strong> is intentional editorial emphasis, not noise).
 *   3. sanitizeNewsroomHtml preserves Halo's structural wrappers
 *      (<article class="halo-published">, <section>) and the answer-block
 *      paragraph contract (<p class="answer-block" itemprop="abstract">).
 *   4. sanitizeNewsroomHtml strips the dangerous surface
 *      (<script>, on* handlers, style attribute, javascript: URLs) and any
 *      class that isn't on the explicit allowlist.
 *
 * Exit code is non-zero on any failed assertion (node:assert/strict throws).
 */

import assert from "node:assert/strict";
import { sanitizeNewsroomHtml } from "../lib/newsroom/htmlSanitizer";
import { normalizeHayloBody } from "../lib/newsroom/hayloBodyNormalizer";

const HALO_SAMPLE = `<h1>Test Headline From Halo</h1>
<article class="halo-published"><section><p class="answer-block" itemprop="abstract">Direct answer for AEO and SGE consumption goes here in plain prose.</p><p>Body prose with <strong>venture capitalists</strong> and <strong>Series A</strong> emphasis preserved.</p></section></article>`;

const HOSTILE_SAMPLE = `<p class="answer-block" itemprop="abstract" onclick="alert(1)" style="color:red">Answer.</p>
<p class="malicious-class">Body.</p>
<script>window.x=1</script>
<a href="javascript:alert(1)">click</a>
<a href="https://example.com">ok</a>
<iframe src="https://evil.tld"></iframe>
<article class="halo-published" onload="x()"><section class="newsroom-local-vibe"><p>nested</p></section></article>`;

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${e?.message ?? String(e)}`);
    failed++;
  }
}

console.log("\nnormalizeHayloBody:");

test("strips the first <h1>", () => {
  const out = normalizeHayloBody(HALO_SAMPLE);
  assert.ok(!out.includes("<h1>"), `expected no <h1> after normalize, got:\n${out}`);
  assert.ok(!out.includes("Test Headline From Halo"), "headline text should be removed with the h1");
});

test("preserves <strong> by default (Halo intentional emphasis)", () => {
  const out = normalizeHayloBody(HALO_SAMPLE);
  assert.ok(out.includes("<strong>venture capitalists</strong>"), "first <strong> should survive");
  assert.ok(out.includes("<strong>Series A</strong>"), "second <strong> should survive");
});

test("opt-in stripStrong:true still removes <strong>", () => {
  const out = normalizeHayloBody(HALO_SAMPLE, { stripStrong: true });
  assert.ok(!out.includes("<strong>"), "stripStrong:true should remove <strong>");
  assert.ok(out.includes("venture capitalists"), "inner text must survive");
});

test("preserves the <article class=\"halo-published\"> wrapper", () => {
  const out = normalizeHayloBody(HALO_SAMPLE);
  assert.ok(out.includes("halo-published"), "halo-published wrapper class must survive");
});

console.log("\nsanitizeNewsroomHtml — Halo allowlist preservation:");

test("preserves <p class=\"answer-block\" itemprop=\"abstract\">", () => {
  const normalized = normalizeHayloBody(HALO_SAMPLE);
  const out = sanitizeNewsroomHtml(normalized);
  assert.ok(/<p\b[^>]*class="answer-block"/.test(out), `answer-block class missing:\n${out}`);
  assert.ok(/<p\b[^>]*itemprop="abstract"/.test(out), `itemprop="abstract" missing:\n${out}`);
});

test("preserves <strong> end-to-end (normalize -> sanitize)", () => {
  const out = sanitizeNewsroomHtml(normalizeHayloBody(HALO_SAMPLE));
  assert.ok(out.includes("<strong>venture capitalists</strong>"), "<strong> dropped during sanitize");
});

test("preserves <article class=\"halo-published\"> and <section>", () => {
  const out = sanitizeNewsroomHtml(normalizeHayloBody(HALO_SAMPLE));
  assert.ok(/<article\b[^>]*class="halo-published"/.test(out), "halo-published article wrapper dropped");
  assert.ok(out.includes("<section>") || /<section\b/.test(out), "section wrapper dropped");
});

console.log("\nsanitizeNewsroomHtml — hostile input hardening:");

test("strips <script>", () => {
  const out = sanitizeNewsroomHtml(HOSTILE_SAMPLE);
  assert.ok(!out.toLowerCase().includes("<script"), `<script> survived:\n${out}`);
  assert.ok(!out.includes("window.x"), "script body text should not be rendered");
});

test("strips on* event handlers", () => {
  const out = sanitizeNewsroomHtml(HOSTILE_SAMPLE);
  assert.ok(!/onclick=/i.test(out), "onclick should be stripped");
  assert.ok(!/onload=/i.test(out), "onload should be stripped");
});

test("strips inline style attribute", () => {
  const out = sanitizeNewsroomHtml(HOSTILE_SAMPLE);
  assert.ok(!/\sstyle=/i.test(out), `style= should be stripped:\n${out}`);
});

test("rejects javascript: scheme on <a href>", () => {
  const out = sanitizeNewsroomHtml(HOSTILE_SAMPLE);
  assert.ok(!out.toLowerCase().includes("javascript:"), `javascript: URL survived:\n${out}`);
});

test("preserves https: <a href> and rewrites rel/target", () => {
  const out = sanitizeNewsroomHtml(HOSTILE_SAMPLE);
  assert.ok(out.includes('href="https://example.com"'), "https URL should survive");
  assert.ok(/rel="nofollow noopener"/.test(out), "rel should be rewritten to nofollow noopener");
  assert.ok(/target="_blank"/.test(out), "target should be _blank");
});

test("strips <iframe>", () => {
  const out = sanitizeNewsroomHtml(HOSTILE_SAMPLE);
  assert.ok(!out.toLowerCase().includes("<iframe"), "<iframe> should be stripped");
});

test("strips disallowed class on <p> while keeping the <p>", () => {
  const out = sanitizeNewsroomHtml(HOSTILE_SAMPLE);
  assert.ok(!out.includes("malicious-class"), `disallowed class survived:\n${out}`);
  assert.ok(out.includes(">Body."), "the <p>Body.</p> tag itself should survive");
});

console.log("");
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

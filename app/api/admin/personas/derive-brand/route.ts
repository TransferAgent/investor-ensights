import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { requireConductor } from "@/lib/conductor-guard";
import { logAuditEvent } from "@/lib/audit";
import { withTenantAsync } from "@/lib/tenant/context";

// MT-4.13.1: derive brand voice from a Haylo essay so the staffer doesn't
// hand-author tagline / feature CTA / vertical (the Haylo IS the gold).
// Pure derive — does not write to the tenant. The wizard pre-fills its brand
// form with the response and lets the human review/edit before saving.
//
// Costs ~$0.001 per call on gpt-4.1-mini. Audited on every call so we can
// trace which essay seeded which persona's brand voice.

export const dynamic = "force-dynamic";

const MODEL = "gpt-4.1-mini";
const MAX_BODY_CHARS = 12_000;

const schema = z.object({
  hayloTitle: z.string().min(3).max(300),
  hayloBodyHtml: z.string().min(50),
  // Optional context — helps the model align brand voice with what the
  // staffer has already typed at Step 1, instead of inventing a new name.
  currentTenant: z
    .object({
      personaDisplayName: z.string().optional(),
      publisherName: z.string().optional(),
      authorName: z.string().optional(),
      companyName: z.string().optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `You are a brand strategist helping a publishing operator stand up a new persona on a programmatic-SEO platform.

You will be given:
- A Haylo essay (title + body HTML) that represents the new persona's voice and subject matter.
- Optional already-typed identity fields (display name, publisher, author, company).

Return STRICT JSON with these exact fields:
{
  "personaDisplayName": string,   // 2-60 chars. Echo the input if provided; otherwise derive a short brand name from the essay.
  "publisherName":      string,   // 2-60 chars. Usually equal to personaDisplayName.
  "authorName":         string,   // 2-60 chars. Usually "<personaDisplayName> Newsroom" if not provided.
  "brandVertical":      string,   // 4-80 chars. The subject vertical in 2-6 words (e.g. "Cap-table & equity guidance", "Local sports betting analytics").
  "brandTagline":       string,   // 20-200 chars. One sentence, ends with a period. Reads like a publication tagline. NO marketing fluff.
  "brandFeatureCta":    string,   // 4-40 chars. The product/service the persona drives toward (2-5 words, no period). Examples: "Cap-table guidance", "Equity activity briefings".
  "confidence":         number,   // 0.0-1.0. Your confidence the essay was substantive enough to derive on.
  "rationale":          string    // 1-2 sentences explaining what cues in the essay drove the derivation.
}

Rules:
- Voice must match the essay's voice — formal/conversational/technical as the essay reads.
- Tagline must be specific to the vertical, not generic ("trusted insights for everyone" is BAD).
- Feature CTA is the single CALL TO ACTION the persona drives toward — usually the product or service mentioned most.
- If the essay is too thin to derive confidently, set confidence < 0.6 and still return your best guess; the operator decides.
- Do NOT use markdown. Do NOT wrap in code fences. Return raw JSON only.`;

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OpenAi_Key;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

function clamp(s: unknown, min: number, max: number, fallback: string): string {
  const v = typeof s === "string" ? s.trim() : "";
  if (v.length >= min) return v.slice(0, max);
  return fallback.slice(0, max);
}

export async function POST(req: NextRequest) {
  const guard = await requireConductor();
  if ("response" in guard) return guard.response;
  const { session } = guard;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.issues?.[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const plain = stripHtml(body.hayloBodyHtml).slice(0, MAX_BODY_CHARS);
  if (plain.length < 50) {
    return NextResponse.json(
      { error: "Essay body is too short to derive brand voice (need 50+ chars of plain text)." },
      { status: 400 },
    );
  }

  const userMessage = JSON.stringify({
    haylo: { title: body.hayloTitle, body: plain },
    currentTenant: body.currentTenant ?? {},
  });

  let raw = "{}";
  let tokensUsed = 0;
  try {
    const client = getClient();
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 600,
    });
    raw = completion.choices[0]?.message?.content ?? "{}";
    tokensUsed = completion.usage?.total_tokens ?? 0;
  } catch (err: any) {
    return NextResponse.json(
      { error: `OpenAI call failed: ${err?.message ?? err}` },
      { status: 502 },
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Model returned non-JSON; re-derive and try again.", raw: raw.slice(0, 200) },
      { status: 502 },
    );
  }

  const ct = body.currentTenant ?? {};
  const personaDisplayName = clamp(parsed.personaDisplayName, 2, 60, ct.personaDisplayName ?? "Newsroom");
  const publisherName = clamp(parsed.publisherName, 2, 60, ct.publisherName ?? personaDisplayName);
  const authorName = clamp(parsed.authorName, 2, 60, ct.authorName ?? `${personaDisplayName} Newsroom`);
  const brandVertical = clamp(parsed.brandVertical, 4, 80, "Local activity reporting");
  const brandTagline = clamp(parsed.brandTagline, 20, 200, "Local activity reporting and analysis.");
  const brandFeatureCta = clamp(parsed.brandFeatureCta, 4, 40, "Activity briefings");
  const confidence = (() => {
    const n = Number(parsed.confidence);
    if (Number.isNaN(n)) return 0.5;
    return Math.max(0, Math.min(1, n));
  })();
  const rationale = clamp(parsed.rationale, 1, 500, "Derived from the supplied Haylo essay.");

  // Audit into the actor's (Conductor) tenant log so we always know which
  // essay + model seeded a persona's brand voice.
  await withTenantAsync(session.tenantSlug, () =>
    logAuditEvent({
      username: session.email,
      action: "persona.brand.derived",
      entityType: "tenant",
      entityId: ct.personaDisplayName ?? "(unknown)",
      details: {
        model: MODEL,
        tokensUsed,
        confidence,
        sourceTitle: body.hayloTitle,
        sourceBodyChars: plain.length,
      },
    }),
  );

  return NextResponse.json({
    personaDisplayName,
    publisherName,
    authorName,
    brandVertical,
    brandTagline,
    brandFeatureCta,
    confidence,
    rationale,
    model: MODEL,
    tokensUsed,
  });
}

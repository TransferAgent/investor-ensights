import OpenAI from "openai";

const AUDITOR_MODEL = "gpt-4o-mini";

export type AuditVerdict = "pass" | "warn" | "fail";

export interface AuditorInput {
  cityName: string;
  stateCode: string;
  localVibe: string | null;
  fullHtml: string;
  factSummaries?: string[];
}

export interface AuditorIssue {
  severity: "low" | "medium" | "high";
  category: "city-mismatch" | "vibe-flow" | "contradiction" | "template-artifact" | "tone" | "other";
  message: string;
}

export interface AuditorResult {
  verdict: AuditVerdict;
  flowScore: number;
  issues: AuditorIssue[];
  summary: string;
  costUsd: number;
  totalTokens: number;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OpenAi_Key;
  if (!apiKey) throw new Error("Missing OpenAI API key. Set OPENAI_API_KEY or OpenAi_Key.");
  return new OpenAI({ apiKey });
}

function costFor(promptTokens: number, completionTokens: number): number {
  const cost = (promptTokens / 1_000_000) * 0.15 + (completionTokens / 1_000_000) * 0.6;
  return Number(cost.toFixed(4));
}

const SYSTEM_PROMPT = `You are a Newsroom Auditor for a press release pipeline. You do NOT write or rewrite content. You only grade.

Your job: judge whether a stitched press release reads as a coherent, locally-relevant document or whether the glue is showing.

Check for these specific failures:
1. city-mismatch: headline names one city but body talks about a different city (Haylo body contamination)
2. vibe-flow: the injected local-vibe paragraph reads like a non-sequitur or is grammatically broken at the seam
3. contradiction: numbers/facts in the local-vibe contradict numbers in the Haylo body
4. template-artifact: visible artifacts of bulk generation ("the Tableicity, team", unfilled comments like "<!-- unfilled:* -->", repeated city names within 8 words, etc.)
5. tone: vibe is on-topic for founders/business OR is the "insufficient commercial signal" sentinel that should not have been injected

Verdict rules:
- "pass": no high-severity issues, score >= 80
- "warn": medium issues only, score 60-79, safe to publish but flag for review
- "fail": any high-severity issue OR score < 60, do not publish

Return STRICT JSON ONLY in this shape:
{
  "verdict": "pass" | "warn" | "fail",
  "flowScore": number 0-100,
  "issues": [{"severity":"low|medium|high","category":"...","message":"..."}],
  "summary": "one-sentence plain-language summary"
}`;

function buildUserPrompt(input: AuditorInput): string {
  const facts = input.factSummaries && input.factSummaries.length > 0
    ? `Grounded facts available for ${input.cityName}, ${input.stateCode}:\n- ${input.factSummaries.join("\n- ")}`
    : `(No fact summaries provided.)`;
  return `Audit this press release for ${input.cityName}, ${input.stateCode}.

Local vibe that was injected: ${input.localVibe ? `"${input.localVibe}"` : "(none — vibe was skipped)"}

${facts}

Full press release HTML:
---
${input.fullHtml}
---

Respond with the JSON object specified in the system prompt.`;
}

export async function auditPressRelease(input: AuditorInput): Promise<AuditorResult> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: AUDITOR_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 600,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`Auditor returned non-JSON: ${raw.slice(0, 200)}`); }

  const verdict: AuditVerdict = parsed.verdict === "pass" || parsed.verdict === "warn" || parsed.verdict === "fail" ? parsed.verdict : "warn";
  const flowScore = typeof parsed.flowScore === "number" ? Math.max(0, Math.min(100, Math.round(parsed.flowScore))) : 0;
  const issuesRaw = Array.isArray(parsed.issues) ? parsed.issues : [];
  const issues: AuditorIssue[] = issuesRaw.map((i: any) => ({
    severity: i?.severity === "high" || i?.severity === "low" ? i.severity : "medium",
    category: ["city-mismatch", "vibe-flow", "contradiction", "template-artifact", "tone"].includes(i?.category) ? i.category : "other",
    message: typeof i?.message === "string" ? i.message : String(i?.message ?? ""),
  }));
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";

  const usage = completion.usage;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;
  const costUsd = costFor(promptTokens, completionTokens);

  return { verdict, flowScore, issues, summary, costUsd, totalTokens };
}

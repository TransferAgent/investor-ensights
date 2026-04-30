import { db } from "@/lib/db";
import {
  newsroomAgents,
  newsroomPipelineJobs,
  newsroomAgentRuns,
  newsroomAgentKnowledge,
  newsroomReviewQueue,
  type NewsroomAgent,
  NEWSROOM_AGENT_ROLES,
  NEWSROOM_PIPELINE_STAGES,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export const AGENT_ROLE_DEFAULTS: Array<{
  role: typeof NEWSROOM_AGENT_ROLES[number];
  displayName: string;
  description: string;
  provider: string;
  modelEndpoint: string;
  systemPrompt: string;
  sources: string[];
}> = [
  {
    role: "researcher",
    displayName: "Researcher",
    description: "Scrapes local news, government data, and SEC filings to surface raw facts about a city.",
    provider: "perplexity",
    modelEndpoint: "sonar-pro",
    systemPrompt: "You are a hyper-local research agent. Find verifiable, dated facts about the target city.",
    sources: ["wbjournal.com", "thisweekinworcester.com", "sec.gov/edgar"],
  },
  {
    role: "data_analyst",
    displayName: "Data Analyst",
    description: "Cross-references researcher leads with Crunchbase / public filings; assigns Investor Ensights Score.",
    provider: "anthropic",
    modelEndpoint: "claude-3-5-sonnet",
    systemPrompt: "You are a fact-checker and entity-resolution analyst. Score leads 1-100 for cap-table fit.",
    sources: ["crunchbase.com", "linkedin.com"],
  },
  {
    role: "copywriter",
    displayName: "Local Copywriter",
    description: "Writes the press release using neighborhood-to-need framing and validated local leads.",
    provider: "openai",
    modelEndpoint: "gpt-4o",
    systemPrompt: "You are a city-native fintech journalist. Use real local anchors, not generic landmarks.",
    sources: [],
  },
  {
    role: "seo_qc",
    displayName: "SEO Quality Control",
    description: "Checks similarity vs. other city pages, flags duplicate-content risk, scores readability.",
    provider: "meta",
    modelEndpoint: "llama-3-70b",
    systemPrompt: "You are an SEO auditor. Flag thin content, near-duplicates, and over-optimized anchors.",
    sources: [],
  },
  {
    role: "internal_linker",
    displayName: "Internal Linker",
    description: "Scans existing knowledge articles + city pages to suggest contextual internal links.",
    provider: "openai",
    modelEndpoint: "gpt-4o-mini",
    systemPrompt: "You insert 2-5 contextual internal links per article from the existing site corpus.",
    sources: [],
  },
];

export async function ensureDefaultAgents(): Promise<NewsroomAgent[]> {
  const existing = await db.select().from(newsroomAgents);
  const existingRoles = new Set(existing.map((a) => a.role));
  const toInsert = AGENT_ROLE_DEFAULTS.filter((a) => !existingRoles.has(a.role));
  if (toInsert.length > 0) {
    await db.insert(newsroomAgents).values(
      toInsert.map((a) => ({
        role: a.role,
        displayName: a.displayName,
        description: a.description,
        provider: a.provider,
        modelEndpoint: a.modelEndpoint,
        systemPrompt: a.systemPrompt,
        sources: a.sources,
        config: {},
        isActive: true,
      }))
    );
  }
  return await db.select().from(newsroomAgents);
}

export function verifyWorkerSecret(req: Request): boolean {
  const provided = req.headers.get("x-newsroom-worker-secret");
  const expected = process.env.NEWSROOM_WORKER_SECRET;
  if (!expected) return false;
  return provided === expected;
}

export const STAGES = NEWSROOM_PIPELINE_STAGES;

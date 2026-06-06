import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireConductor } from "@/lib/conductor-guard";
import { generateArticleMeta } from "@/lib/newsroom/articleMetaGenerator";

// Live SEO meta preview for the Persona Wizard. Uses the SAME LLM generator the
// live pair pipeline uses, so what staff see here is exactly the engine that
// will produce published meta for this persona.
export const dynamic = "force-dynamic";

const previewSchema = z.object({
  personaDisplayName: z.string().min(1).max(100),
  brandTagline: z.string().min(1).max(300),
  brandFeatureCta: z.string().min(1).max(200),
  // Optional preview city — defaults to a representative US example so the
  // preview lights up before the staffer has uploaded their City Batch.
  cityName: z.string().min(1).max(100).default("Austin"),
  stateCode: z.string().min(2).max(2).default("TX"),
  hayloTitle: z.string().max(300).default("Sample Haylo Headline About Local Equity Activity"),
});

export async function POST(req: NextRequest) {
  const guard = await requireConductor();
  if ("response" in guard) return guard.response;

  let body: z.infer<typeof previewSchema>;
  try {
    body = previewSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.issues?.[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const meta = await generateArticleMeta({
    articleTitle: body.hayloTitle,
    // No real article body at wizard time — seed the generator with the sample
    // headline + tagline so the preview reflects the live engine's style.
    articleBody: `${body.hayloTitle}. ${body.brandTagline.trim()}`,
    cityName: body.cityName,
    brand: {
      personaDisplayName: body.personaDisplayName.trim(),
      brandTagline: body.brandTagline.trim(),
    },
  });

  // On "needs-meta" the generator returns the last rejected candidate for
  // visibility — do NOT surface it as if it were usable meta. Show empty
  // strings and let metaStatus tell the wizard it needs a human.
  const ok = meta.status === "ok";
  const metaTitle = ok ? meta.title ?? "" : "";
  const metaDescription = ok ? meta.description ?? "" : "";
  return NextResponse.json({
    metaTitle,
    metaDescription,
    metaTitleLength: metaTitle.length,
    metaDescriptionLength: metaDescription.length,
    metaStatus: meta.status,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireConductor } from "@/lib/conductor-guard";
import {
  buildMetaTitle,
  buildMetaDescription,
} from "@/lib/newsroom/pairProcessor";
import type { BrandContext } from "@/lib/newsroom/brandContext";

// MT-4.13: live SEO meta preview for the Persona Wizard. Uses the SAME
// deterministic Tier-2 builders the live pair pipeline uses, so what staff
// see here is exactly what published articles will get for this persona.
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

  const brand: BrandContext = {
    slug: "preview",
    personaDisplayName: body.personaDisplayName.trim(),
    publisherName: body.personaDisplayName.trim(),
    authorName: `${body.personaDisplayName.trim()} Newsroom`,
    brandVertical: "preview",
    brandTagline: body.brandTagline.trim(),
    brandFeatureCta: body.brandFeatureCta.trim(),
    brandHomeUrl: null,
  };

  const metaTitle = buildMetaTitle(
    brand,
    body.cityName,
    body.stateCode.toUpperCase(),
    body.hayloTitle,
  );
  const metaDescription = buildMetaDescription(
    brand,
    body.cityName,
    body.stateCode.toUpperCase(),
    body.hayloTitle,
  );

  return NextResponse.json({
    metaTitle,
    metaDescription,
    metaTitleLength: metaTitle.length,
    metaDescriptionLength: metaDescription.length,
  });
}

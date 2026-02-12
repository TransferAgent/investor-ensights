import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cities = await storage.getCities(false);
  return NextResponse.json(cities);
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { cityName, stateCode, stateName, streetAddress, zipCode, phoneNumber, email, slug, localLandmarks, nearbyCities, latitude, longitude, isPublished, displayOrder, metaTitle, metaDescription, allowIndexing } = body;

    if (!cityName || !stateCode) {
      return NextResponse.json({ error: "City name and state code are required" }, { status: 400 });
    }

    const finalSlug = slug || `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stateCode.toLowerCase()}`;
    const existing = await storage.getCityBySlug(finalSlug);
    if (existing) {
      return NextResponse.json({ error: "A city with this slug already exists" }, { status: 409 });
    }

    const city = await storage.createCity({
      cityName,
      stateCode,
      stateName: stateName || null,
      streetAddress: streetAddress || null,
      zipCode: zipCode || null,
      phoneNumber: phoneNumber || null,
      email: email || null,
      slug: finalSlug,
      localLandmarks: localLandmarks || [],
      nearbyCities: nearbyCities || [],
      latitude: latitude || null,
      longitude: longitude || null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      allowIndexing: allowIndexing ?? true,
      isPublished: isPublished ?? false,
      displayOrder: displayOrder ?? 0,
    });

    return NextResponse.json(city, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create city" }, { status: 400 });
  }
}

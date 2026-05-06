import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { geocodeAddress } from "@/lib/geocoding";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (body.allowIndexing !== undefined && typeof body.allowIndexing !== "boolean") {
      return NextResponse.json({ error: "allowIndexing must be a boolean" }, { status: 400 });
    }
    if (body.isPublished !== undefined && typeof body.isPublished !== "boolean") {
      return NextResponse.json({ error: "isPublished must be a boolean" }, { status: 400 });
    }

    if (body.allowIndexing === true) {
      const current = await storage.getCityById(id);
      if (!current) {
        return NextResponse.json({ error: "City not found" }, { status: 404 });
      }
      const willBePublished = body.isPublished === undefined ? current.isPublished : body.isPublished;
      if (!willBePublished) {
        return NextResponse.json(
          { error: "Cannot enable Index on a non-published city. Publish the city first, then flip Index." },
          { status: 409 }
        );
      }
    }

    if (!body.latitude || !body.longitude) {
      const addressForGeocode = body.streetAddress || body.cityName || "";
      const cityName = body.cityName || "";
      const stateCode = body.stateCode || "";
      if (addressForGeocode) {
        const geo = await geocodeAddress(body.streetAddress || "", cityName, stateCode, body.zipCode);
        if (geo.success) {
          body.latitude = String(geo.latitude);
          body.longitude = String(geo.longitude);
        }
      }
    }

    const city = await storage.updateCity(id, body);
    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }
    await logAuditEvent({ username: session.username, action: "update", entityType: "city", entityId: id, details: body });
    return NextResponse.json(city);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update city" }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await storage.deleteCity(id);
    await logAuditEvent({ username: session.username, action: "delete", entityType: "city", entityId: id });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete city" }, { status: 400 });
  }
}

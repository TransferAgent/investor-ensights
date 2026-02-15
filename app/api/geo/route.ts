import { NextRequest, NextResponse } from "next/server";

const STATE_ABBREVS: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
  "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
  "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
  "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
  "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
  "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
  "Wisconsin": "WI", "Wyoming": "WY",
};

export async function GET(request: NextRequest) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : null;

    if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("192.168.")) {
      return NextResponse.json({ stateCode: null, stateName: null, city: null });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
      headers: { "User-Agent": "CityLandingPageManager/1.0" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ stateCode: null, stateName: null, city: null });
    }

    const data = await res.json();

    if (data.error || data.country_code !== "US") {
      return NextResponse.json({ stateCode: null, stateName: null, city: null });
    }

    const stateName = data.region || null;
    const stateCode = data.region_code || (stateName ? (STATE_ABBREVS[stateName] || null) : null);

    return NextResponse.json({
      stateCode,
      stateName,
      city: data.city || null,
    }, {
      headers: {
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ stateCode: null, stateName: null, city: null });
  }
}

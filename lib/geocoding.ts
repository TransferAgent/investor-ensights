interface GeocodeResult {
  latitude: number
  longitude: number
  formattedAddress: string
  success: boolean
  error?: string
}

export async function geocodeAddress(
  streetAddress: string,
  city: string,
  state: string,
  zipCode?: string
): Promise<GeocodeResult> {
  const apiKey = process.env.OPENCAGE_API_KEY
  if (!apiKey) {
    return {
      latitude: 0,
      longitude: 0,
      formattedAddress: "",
      success: false,
      error: "OPENCAGE_API_KEY not configured",
    }
  }

  const parts = [streetAddress, city, state, zipCode].filter(Boolean)
  const fullAddress = parts.join(", ").trim()

  if (!fullAddress) {
    return {
      latitude: 0,
      longitude: 0,
      formattedAddress: "",
      success: false,
      error: "No address provided",
    }
  }

  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(fullAddress)}&key=${apiKey}&countrycode=us&limit=1`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return {
        latitude: 0,
        longitude: 0,
        formattedAddress: "",
        success: false,
        error: `OpenCage API returned status ${response.status}`,
      }
    }

    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const result = data.results[0]
      return {
        latitude: result.geometry.lat,
        longitude: result.geometry.lng,
        formattedAddress: result.formatted || fullAddress,
        success: true,
      }
    }

    return {
      latitude: 0,
      longitude: 0,
      formattedAddress: "",
      success: false,
      error: "No results found for this address",
    }
  } catch (error: any) {
    console.error("Geocoding error:", error)
    return {
      latitude: 0,
      longitude: 0,
      formattedAddress: "",
      success: false,
      error: error.message || "Failed to connect to geocoding service",
    }
  }
}

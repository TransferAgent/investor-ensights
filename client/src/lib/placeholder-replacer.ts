export interface CityData {
  cityName: string;
  stateCode: string;
  stateName?: string;
  slug: string;
  streetAddress?: string;
  localLandmarks: string[];
  nearbyCities: string[];
  phoneNumber?: string;
  email?: string;
}

export function replacePlaceholders(
  template: string,
  city: CityData
): string {
  if (!template) return "";
  return template
    .replace(/\{\{city\}\}/g, city.cityName)
    .replace(/\{\{state\}\}/g, city.stateCode)
    .replace(/\{\{state_name\}\}/g, city.stateName || city.stateCode)
    .replace(/\{\{slug\}\}/g, city.slug)
    .replace(/\{\{address\}\}/g, city.streetAddress || "")
    .replace(/\{\{landmarks\}\}/g, city.localLandmarks.join(", "))
    .replace(/\{\{nearby_cities\}\}/g, city.nearbyCities.join(", "))
    .replace(/\{\{phone\}\}/g, city.phoneNumber || "")
    .replace(/\{\{email\}\}/g, city.email || "");
}

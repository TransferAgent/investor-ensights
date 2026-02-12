import { storage } from "./storage";

const SEED_CITIES = [
  { cityName: "Irvine", stateCode: "CA", stateName: "California", slug: "irvine-ca", streetAddress: "100 Spectrum Center Dr", zipCode: "92618", phoneNumber: "(949) 555-0101", email: "irvine@yourcompany.com", latitude: "33.68370000", longitude: "-117.79470000", localLandmarks: ["Irvine Spectrum Center", "Great Park", "UCI Campus", "Bommer Canyon"], nearbyCities: ["Newport Beach", "Costa Mesa", "Tustin", "Lake Forest"], isPublished: true, displayOrder: 1 },
  { cityName: "Los Angeles", stateCode: "CA", stateName: "California", slug: "los-angeles-ca", streetAddress: "633 W 5th St", zipCode: "90071", phoneNumber: "(213) 555-0102", email: "la@yourcompany.com", latitude: "34.05220000", longitude: "-118.24370000", localLandmarks: ["Hollywood Sign", "Griffith Observatory", "Santa Monica Pier", "The Getty Center"], nearbyCities: ["Pasadena", "Santa Monica", "Burbank", "Long Beach"], isPublished: true, displayOrder: 2 },
  { cityName: "San Francisco", stateCode: "CA", stateName: "California", slug: "san-francisco-ca", streetAddress: "101 Market St", zipCode: "94105", phoneNumber: "(415) 555-0103", email: "sf@yourcompany.com", latitude: "37.77490000", longitude: "-122.41940000", localLandmarks: ["Golden Gate Bridge", "Fisherman's Wharf", "Alcatraz Island", "Union Square"], nearbyCities: ["Oakland", "Berkeley", "Daly City", "San Jose"], isPublished: true, displayOrder: 3 },
  { cityName: "New York", stateCode: "NY", stateName: "New York", slug: "new-york-ny", streetAddress: "350 5th Ave", zipCode: "10118", phoneNumber: "(212) 555-0104", email: "nyc@yourcompany.com", latitude: "40.74840000", longitude: "-73.98560000", localLandmarks: ["Empire State Building", "Central Park", "Times Square", "Brooklyn Bridge"], nearbyCities: ["Brooklyn", "Queens", "Jersey City", "Hoboken"], isPublished: true, displayOrder: 4 },
  { cityName: "Chicago", stateCode: "IL", stateName: "Illinois", slug: "chicago-il", streetAddress: "233 S Wacker Dr", zipCode: "60606", phoneNumber: "(312) 555-0105", email: "chicago@yourcompany.com", latitude: "41.87820000", longitude: "-87.62980000", localLandmarks: ["Willis Tower", "Millennium Park", "Navy Pier", "Art Institute of Chicago"], nearbyCities: ["Evanston", "Oak Park", "Naperville", "Schaumburg"], isPublished: true, displayOrder: 5 },
  { cityName: "Houston", stateCode: "TX", stateName: "Texas", slug: "houston-tx", streetAddress: "1000 Main St", zipCode: "77002", phoneNumber: "(713) 555-0106", email: "houston@yourcompany.com", latitude: "29.76040000", longitude: "-95.36980000", localLandmarks: ["Space Center Houston", "Museum District", "Hermann Park", "Houston Zoo"], nearbyCities: ["Sugar Land", "The Woodlands", "Katy", "Pearland"], isPublished: true, displayOrder: 6 },
  { cityName: "Phoenix", stateCode: "AZ", stateName: "Arizona", slug: "phoenix-az", streetAddress: "2 N Central Ave", zipCode: "85004", phoneNumber: "(602) 555-0107", email: "phoenix@yourcompany.com", latitude: "33.44840000", longitude: "-112.07400000", localLandmarks: ["Desert Botanical Garden", "Camelback Mountain", "Heard Museum", "Papago Park"], nearbyCities: ["Scottsdale", "Tempe", "Mesa", "Chandler"], isPublished: true, displayOrder: 7 },
  { cityName: "Philadelphia", stateCode: "PA", stateName: "Pennsylvania", slug: "philadelphia-pa", streetAddress: "1500 Market St", zipCode: "19102", phoneNumber: "(215) 555-0108", email: "philly@yourcompany.com", latitude: "39.95260000", longitude: "-75.16350000", localLandmarks: ["Liberty Bell", "Independence Hall", "Philadelphia Museum of Art", "Reading Terminal Market"], nearbyCities: ["Cherry Hill", "Camden", "Wilmington", "King of Prussia"], isPublished: true, displayOrder: 8 },
  { cityName: "Denver", stateCode: "CO", stateName: "Colorado", slug: "denver-co", streetAddress: "1660 Lincoln St", zipCode: "80264", phoneNumber: "(303) 555-0109", email: "denver@yourcompany.com", latitude: "39.73920000", longitude: "-104.99030000", localLandmarks: ["Red Rocks Amphitheatre", "Denver Art Museum", "Union Station", "City Park"], nearbyCities: ["Aurora", "Lakewood", "Boulder", "Arvada"], isPublished: true, displayOrder: 9 },
  { cityName: "Seattle", stateCode: "WA", stateName: "Washington", slug: "seattle-wa", streetAddress: "1201 3rd Ave", zipCode: "98101", phoneNumber: "(206) 555-0110", email: "seattle@yourcompany.com", latitude: "47.60620000", longitude: "-122.33210000", localLandmarks: ["Space Needle", "Pike Place Market", "Museum of Pop Culture", "Kerry Park"], nearbyCities: ["Bellevue", "Tacoma", "Redmond", "Kirkland"], isPublished: true, displayOrder: 10 },
  { cityName: "Miami", stateCode: "FL", stateName: "Florida", slug: "miami-fl", streetAddress: "200 S Biscayne Blvd", zipCode: "33131", phoneNumber: "(305) 555-0111", email: "miami@yourcompany.com", latitude: "25.76170000", longitude: "-80.19180000", localLandmarks: ["South Beach", "Wynwood Walls", "Vizcaya Museum", "Bayside Marketplace"], nearbyCities: ["Fort Lauderdale", "Coral Gables", "Hialeah", "Miami Beach"], isPublished: true, displayOrder: 11 },
  { cityName: "Atlanta", stateCode: "GA", stateName: "Georgia", slug: "atlanta-ga", streetAddress: "191 Peachtree St NE", zipCode: "30303", phoneNumber: "(404) 555-0112", email: "atlanta@yourcompany.com", latitude: "33.74900000", longitude: "-84.38800000", localLandmarks: ["Georgia Aquarium", "Centennial Olympic Park", "Piedmont Park", "High Museum of Art"], nearbyCities: ["Marietta", "Decatur", "Sandy Springs", "Roswell"], isPublished: true, displayOrder: 12 },
  { cityName: "Boston", stateCode: "MA", stateName: "Massachusetts", slug: "boston-ma", streetAddress: "100 Federal St", zipCode: "02110", phoneNumber: "(617) 555-0113", email: "boston@yourcompany.com", latitude: "42.36010000", longitude: "-71.05890000", localLandmarks: ["Freedom Trail", "Fenway Park", "Boston Common", "Faneuil Hall"], nearbyCities: ["Cambridge", "Brookline", "Somerville", "Quincy"], isPublished: true, displayOrder: 13 },
  { cityName: "Dallas", stateCode: "TX", stateName: "Texas", slug: "dallas-tx", streetAddress: "2200 Ross Ave", zipCode: "75201", phoneNumber: "(214) 555-0114", email: "dallas@yourcompany.com", latitude: "32.78670000", longitude: "-96.79700000", localLandmarks: ["Dallas Arboretum", "Reunion Tower", "Perot Museum", "Deep Ellum"], nearbyCities: ["Fort Worth", "Arlington", "Plano", "Irving"], isPublished: true, displayOrder: 14 },
  { cityName: "Austin", stateCode: "TX", stateName: "Texas", slug: "austin-tx", streetAddress: "301 Congress Ave", zipCode: "78701", phoneNumber: "(512) 555-0115", email: "austin@yourcompany.com", latitude: "30.26720000", longitude: "-97.74310000", localLandmarks: ["Texas State Capitol", "Lady Bird Lake", "South Congress Ave", "Barton Springs Pool"], nearbyCities: ["Round Rock", "Cedar Park", "Georgetown", "San Marcos"], isPublished: false, displayOrder: 15 },
  { cityName: "Nashville", stateCode: "TN", stateName: "Tennessee", slug: "nashville-tn", streetAddress: "150 4th Ave N", zipCode: "37219", phoneNumber: "(615) 555-0116", email: "nashville@yourcompany.com", latitude: "36.16270000", longitude: "-86.78160000", localLandmarks: ["Broadway Honky Tonks", "Country Music Hall of Fame", "The Parthenon", "Grand Ole Opry"], nearbyCities: ["Franklin", "Murfreesboro", "Hendersonville", "Brentwood"], isPublished: false, displayOrder: 16 },
  { cityName: "Portland", stateCode: "OR", stateName: "Oregon", slug: "portland-or", streetAddress: "111 SW 5th Ave", zipCode: "97204", phoneNumber: "(503) 555-0117", email: "portland@yourcompany.com", latitude: "45.52300000", longitude: "-122.67650000", localLandmarks: ["Powell's City of Books", "International Rose Test Garden", "Portland Art Museum", "Forest Park"], nearbyCities: ["Beaverton", "Lake Oswego", "Tigard", "Vancouver WA"], isPublished: false, displayOrder: 17 },
  { cityName: "San Diego", stateCode: "CA", stateName: "California", slug: "san-diego-ca", streetAddress: "600 B St", zipCode: "92101", phoneNumber: "(619) 555-0118", email: "sandiego@yourcompany.com", latitude: "32.71570000", longitude: "-117.16110000", localLandmarks: ["San Diego Zoo", "Balboa Park", "Gaslamp Quarter", "USS Midway Museum"], nearbyCities: ["Chula Vista", "Carlsbad", "Escondido", "La Jolla"], isPublished: false, displayOrder: 18 },
];

const DEFAULT_TEMPLATE = {
  templateName: "Standard City Page",
  templateDescription: "Default template for all city landing pages with professional services messaging",
  metaTitlePattern: "{{city}} Sales & Marketing Services | YourCompany",
  metaDescriptionPattern: "Professional sales and marketing services in {{city}}, {{state_name}}. Our local team delivers results-driven solutions for businesses in the {{city}} metro area.",
  h1HeaderPattern: "Welcome to Our {{city}} Office",
  h2SubheaderPattern: "Professional Sales & Marketing Services in {{city}}, {{state_name}}",
  bodyContentPattern: "We're proud to serve the {{city}} community with comprehensive sales and marketing solutions tailored to the local market. Our {{city}} team brings deep knowledge of the {{state_name}} business landscape, helping companies of all sizes achieve their growth goals.\n\nFrom strategic consulting to full-service campaign management, our {{city}} office provides the expertise you need to stand out in today's competitive marketplace. Whether you're a startup looking to establish your brand or an established business seeking to expand your reach, we have the tools and talent to make it happen.\n\nLocated conveniently at {{address}}, we're easily accessible to businesses throughout the greater {{city}} area, including {{nearby_cities}}. Stop by our office or give us a call to schedule a free consultation.",
  ctaText: "Schedule a Free Consultation",
  ctaUrlPattern: "/contact?location={{slug}}",
  isActive: true,
  isDefault: true,
  version: 1,
  createdBy: "system",
};

const AGGRESSIVE_TEMPLATE = {
  templateName: "Growth-Focused Template",
  templateDescription: "High-energy template focused on growth metrics and ROI for competitive markets",
  metaTitlePattern: "Grow Your Business in {{city}} | YourCompany",
  metaDescriptionPattern: "Accelerate your business growth in {{city}}, {{state_name}}. Data-driven sales and marketing strategies that deliver measurable ROI for {{city}} businesses.",
  h1HeaderPattern: "Accelerate Your Growth in {{city}}",
  h2SubheaderPattern: "Data-Driven Sales & Marketing for {{city}} Businesses",
  bodyContentPattern: "In the competitive {{city}} market, you need a partner who delivers results, not excuses. Our {{city}} team specializes in data-driven sales and marketing strategies that turn prospects into loyal customers.\n\nWe've helped hundreds of {{state_name}} businesses achieve double-digit growth through our proven methodology. From lead generation to conversion optimization, every campaign we run for our {{city}} clients is backed by analytics and designed for maximum ROI.\n\nOur office near {{landmarks}} puts us right in the heart of the {{city}} business community. We know this market because we're part of it.",
  ctaText: "Get Your Free Growth Assessment",
  ctaUrlPattern: "/contact?location={{slug}}&type=growth",
  isActive: true,
  isDefault: false,
  version: 1,
  createdBy: "system",
};

export async function seedDatabase() {
  const stats = await storage.getStats();
  if (stats.totalCities > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database...");

  const hasAdmin = await storage.adminExists();
  if (!hasAdmin) {
    const { scryptSync, randomBytes } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync("admin123", salt, 64).toString("hex");
    await storage.createAdmin({
      username: "admin",
      passwordHash: `${salt}:${hash}`,
      displayName: "Admin User",
    });
    console.log("Created default admin user (admin / admin123)");
  }

  const defaultTemplate = await storage.createTemplate(DEFAULT_TEMPLATE);
  const growthTemplate = await storage.createTemplate(AGGRESSIVE_TEMPLATE);
  console.log(`Created ${2} templates`);

  for (const cityData of SEED_CITIES) {
    const city = await storage.createCity(cityData);
    const useGrowth = ["new-york-ny", "los-angeles-ca", "chicago-il", "houston-tx"].includes(cityData.slug);
    await storage.upsertAssignment({
      cityId: city.id,
      templateId: useGrowth ? growthTemplate.id : defaultTemplate.id,
      assignedBy: "system",
    });
  }
  console.log(`Created ${SEED_CITIES.length} cities with template assignments`);
  console.log("Seeding complete!");
}

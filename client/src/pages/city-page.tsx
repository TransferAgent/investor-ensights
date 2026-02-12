import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  Navigation,
  Building2,
  ArrowRight,
} from "lucide-react";
import { replacePlaceholders, type CityData } from "@/lib/placeholder-replacer";
import type { CityLocation, ContentTemplate, CityContentAssignment } from "@shared/schema";

interface CityPageData {
  city: CityLocation;
  template: ContentTemplate | null;
  assignment: CityContentAssignment | null;
}

function CityPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary py-16">
        <div className="mx-auto max-w-4xl px-4">
          <Skeleton className="mb-2 h-5 w-32 bg-primary-foreground/20" />
          <Skeleton className="mb-3 h-12 w-96 bg-primary-foreground/20" />
          <Skeleton className="h-6 w-64 bg-primary-foreground/20" />
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton className="mb-4 h-4 w-full" />
        <Skeleton className="mb-4 h-4 w-5/6" />
        <Skeleton className="mb-4 h-4 w-4/6" />
        <Skeleton className="mb-8 h-4 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  );
}

export default function CityPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, error } = useQuery<CityPageData>({
    queryKey: ["/api/locations", slug],
    enabled: !!slug,
  });

  if (isLoading) return <CityPageSkeleton />;

  if (error || !data?.city) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="mx-4 max-w-md p-8 text-center">
          <MapPin className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h1 className="mb-2 text-2xl font-bold">Location Not Found</h1>
          <p className="mb-6 text-muted-foreground">
            We couldn't find a location page for this city. It may not be available yet.
          </p>
          <Link href="/">
            <Button data-testid="button-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to All Locations
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { city, template, assignment } = data;
  const landmarks = (city.localLandmarks as string[]) || [];
  const nearbyCities = (city.nearbyCities as string[]) || [];

  const cityData: CityData = {
    cityName: city.cityName,
    stateCode: city.stateCode,
    stateName: city.stateName || undefined,
    slug: city.slug,
    streetAddress: city.streetAddress || undefined,
    localLandmarks: landmarks,
    nearbyCities: nearbyCities,
    phoneNumber: city.phoneNumber || undefined,
    email: city.email || undefined,
  };

  const h1 =
    assignment?.customH1 ||
    replacePlaceholders(template?.h1HeaderPattern || "", cityData) ||
    `Welcome to Our ${city.cityName} Office`;

  const h2 = replacePlaceholders(
    template?.h2SubheaderPattern || "",
    cityData
  ) || `Professional Services in ${city.cityName}, ${city.stateCode}`;

  const body =
    assignment?.customBody ||
    replacePlaceholders(template?.bodyContentPattern || "", cityData) ||
    `We're proud to serve the ${city.cityName} community with top-tier sales and marketing solutions. Our local team understands the unique needs of businesses in ${city.stateName || city.stateCode} and is ready to help you grow.`;

  const ctaText = template?.ctaText || "Contact Us Today";

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-visible bg-primary py-16 md:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
        <div className="relative mx-auto max-w-4xl px-4">
          <Link href="/">
            <span className="mb-4 inline-flex items-center gap-1.5 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors cursor-pointer">
              <ArrowLeft className="h-3.5 w-3.5" />
              All Locations
            </span>
          </Link>
          <h1
            className="mb-3 text-3xl font-bold text-primary-foreground md:text-4xl lg:text-5xl"
            data-testid="text-city-h1"
          >
            {h1}
          </h1>
          <p
            className="text-lg text-primary-foreground/80 md:text-xl"
            data-testid="text-city-h2"
          >
            {h2}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-10 flex flex-col gap-6 md:flex-row">
          <div className="flex-1">
            <div
              className="prose prose-lg max-w-none dark:prose-invert"
              data-testid="text-city-body"
            >
              {body.split("\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="w-full md:w-72 shrink-0 space-y-4">
            {(city.streetAddress || city.phoneNumber || city.email) && (
              <Card className="p-5">
                <h3 className="mb-3 font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Contact Info
                </h3>
                <div className="space-y-3 text-sm">
                  {city.streetAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {city.streetAddress}
                        {city.zipCode && (
                          <>
                            <br />
                            {city.cityName}, {city.stateCode} {city.zipCode}
                          </>
                        )}
                      </span>
                    </div>
                  )}
                  {city.phoneNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <a
                        href={`tel:${city.phoneNumber}`}
                        className="text-primary hover:underline"
                        data-testid="link-phone"
                      >
                        {city.phoneNumber}
                      </a>
                    </div>
                  )}
                  {city.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <a
                        href={`mailto:${city.email}`}
                        className="text-primary hover:underline"
                        data-testid="link-email"
                      >
                        {city.email}
                      </a>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>

        {landmarks.length > 0 && (
          <section className="mb-10">
            <h3 className="mb-4 text-xl font-semibold" data-testid="text-landmarks-title">
              Near Our {city.cityName} Office
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {landmarks.map((landmark, i) => (
                <Card key={i} className="flex items-center gap-3 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Navigation className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm">{landmark}</span>
                </Card>
              ))}
            </div>
          </section>
        )}

        {city.mapEmbedUrl && (
          <section className="mb-10">
            <h3 className="mb-4 text-xl font-semibold">Find Us</h3>
            <div className="overflow-hidden rounded-md border">
              <iframe
                src={city.mapEmbedUrl}
                width="100%"
                height="400"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Map of ${city.cityName} office`}
              />
            </div>
          </section>
        )}

        {nearbyCities.length > 0 && (
          <section className="mb-10">
            <h3 className="mb-4 text-xl font-semibold">We Also Serve</h3>
            <div className="flex flex-wrap gap-2">
              {nearbyCities.map((nc, i) => (
                <Badge key={i} variant="secondary">
                  {nc}
                </Badge>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-md bg-primary p-8 text-center md:p-12">
          <h3 className="mb-3 text-2xl font-bold text-primary-foreground">
            Ready to Get Started?
          </h3>
          <p className="mb-6 text-primary-foreground/80">
            Contact our {city.cityName} team today and discover how we can help
            grow your business.
          </p>
          <Button
            variant="secondary"
            size="lg"
            data-testid="button-cta"
          >
            {ctaText}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            name: `YourCompany - ${city.cityName}`,
            address: {
              "@type": "PostalAddress",
              streetAddress: city.streetAddress,
              addressLocality: city.cityName,
              addressRegion: city.stateCode,
              postalCode: city.zipCode,
              addressCountry: "US",
            },
            ...(city.latitude &&
              city.longitude && {
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: Number(city.latitude),
                  longitude: Number(city.longitude),
                },
              }),
            ...(city.phoneNumber && { telephone: city.phoneNumber }),
            url: `${window.location.origin}/locations/${city.slug}`,
            openingHours: "Mo-Fr 09:00-18:00",
          }),
        }}
      />
    </div>
  );
}

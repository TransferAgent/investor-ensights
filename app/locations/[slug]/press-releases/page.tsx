import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { storage } from "@/lib/storage";
import { ArrowLeft } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.tableicity.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cities = await storage.getCities(true);
  const city = cities.find(c => c.slug === slug);
  if (!city) return { title: "Not Found" };

  return {
    title: city.cityName + ", " + city.stateCode + " Press Releases | Tableicity",
    description: "All press releases and news for Tableicity in " + city.cityName + ", " + city.stateName + ". Cap table security, privacy-first equity management, and more.",
    alternates: { canonical: BASE_URL + "/locations/" + slug + "/press-releases" },
    robots: {
      index: true,
      follow: true,
      "max-snippet": -1 as any,
      "max-image-preview": "large" as any,
      "max-video-preview": -1 as any,
    },
  };
}

export default async function PressReleasesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cities = await storage.getCities(true);
  const city = cities.find(c => c.slug === slug);
  if (!city) notFound();

  const articles = await storage.getPublishedArticlesByCitySlug(city.slug);

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href={"/locations/" + slug}
          className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors mb-6"
          data-testid="link-back-to-city"
        >
          <ArrowLeft className="h-4 w-4" />
          {"Back to " + city.cityName}
        </Link>

        <h1 className="text-2xl font-bold text-white mb-1" data-testid="text-press-releases-title">
          {"Press Releases — " + city.cityName + ", " + city.stateCode}
        </h1>
        <p className="text-sm text-blue-200/60 mb-8">
          {"All published press releases for Tableicity in " + city.cityName + ", " + city.stateName}
        </p>

        {articles.length === 0 ? (
          <p className="text-blue-200/50 text-sm">No press releases available yet.</p>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={"/discovery/knowledge/" + article.slug}
                className="block p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10"
                data-testid={"link-article-" + article.slug}
              >
                <h2 className="text-base font-medium text-white/90 leading-tight">
                  {article.headline.replace(/<[^>]*>/g, "")}
                </h2>
                {article.metaDescription && (
                  <p className="text-sm text-blue-200/60 mt-1.5 line-clamp-2">
                    {article.metaDescription}
                  </p>
                )}
                {article.datePublished && (
                  <p className="text-xs text-blue-200/40 mt-2">
                    {new Date(article.datePublished).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-white/10 flex items-center gap-4 text-xs text-blue-200/40">
          <Link href="/" className="hover:text-blue-200/60 transition-colors">Home</Link>
          <Link href="/locations" className="hover:text-blue-200/60 transition-colors">Locations</Link>
          <Link
            href={"/locations/" + slug}
            className="hover:text-blue-200/60 transition-colors"
          >
            {city.cityName}
          </Link>
        </div>
      </div>
    </div>
  );
}

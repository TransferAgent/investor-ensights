export interface AuthorConfig {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  avatarPath: string;
  publisherName: string;
  bioHtml: string;
  /**
   * True when the resolved name matches a known author profile (avatar, social,
   * bio all belong to this person). False when the row carries an unrecognized
   * author name — in that case the byline shows the name but the renderer must
   * suppress avatar, social link, and the bio box to avoid mixed identity.
   */
  hasFullProfile: boolean;
}

export const PLATFORM_AUTHOR: AuthorConfig = {
  name: "Brian Reynolds",
  title: "Senior Financial Analyst",
  email: "info@investorensights.com",
  phone: "(800) 684-8034",
  linkedinUrl: "https://www.linkedin.com/in/brian-reynolds-aa62a457/",
  avatarPath: "/john-reynolds.jpg",
  publisherName: "Investor Ensights",
  bioHtml:
    "Brian Reynolds is the Senior Financial Analyst at Investor Ensights, with 10+ years covering U.S. company formation, equity activity, and small-business capital markets. His work focuses on translating institutional-grade data into clear, actionable insights for founders and investors. Brian publishes daily across Investor Ensights and its sister brands — Tableicity, Veltroy, Haylo, Texitie, and Payrol.",
  hasFullProfile: true,
};

/**
 * Registry of known author profiles keyed by lowercased display name. Add new
 * staff here (with their own avatar, social, bio) before assigning their name
 * to any tenant's `author_name` column. Names not in this registry render as
 * "byline name only" with no avatar/social/bio (prevents mixed identity).
 */
const KNOWN_AUTHORS: Record<string, AuthorConfig> = {
  "brian reynolds": PLATFORM_AUTHOR,
};

export function resolveAuthor(opts: {
  articleAuthorName?: string | null;
  articlePublisherName?: string | null;
}): AuthorConfig {
  const rawName = opts.articleAuthorName?.trim();
  const publisher = opts.articlePublisherName?.trim();
  const effectivePublisher =
    publisher && publisher.length > 0 ? publisher : PLATFORM_AUTHOR.publisherName;

  if (!rawName || rawName.length === 0) {
    return { ...PLATFORM_AUTHOR, publisherName: effectivePublisher };
  }

  const known = KNOWN_AUTHORS[rawName.toLowerCase()];
  if (known) {
    return { ...known, publisherName: effectivePublisher };
  }

  // Unknown author name: render the name + publisher only. Suppress avatar,
  // social, and bio to avoid attaching the platform author's identity to a
  // different person.
  return {
    name: rawName,
    title: PLATFORM_AUTHOR.title,
    email: PLATFORM_AUTHOR.email,
    phone: PLATFORM_AUTHOR.phone,
    linkedinUrl: "",
    avatarPath: "",
    publisherName: effectivePublisher,
    bioHtml: "",
    hasFullProfile: false,
  };
}

export function formatPublishedDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

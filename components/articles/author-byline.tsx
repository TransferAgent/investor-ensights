import Image from "next/image";
import { Facebook } from "lucide-react";
import { formatPublishedDate, type AuthorConfig } from "@/lib/author-config";

interface AuthorBylineProps {
  author: AuthorConfig;
  publishedAt: Date | string | null | undefined;
}

export function AuthorByline({ author, publishedAt }: AuthorBylineProps) {
  const dateLabel = formatPublishedDate(publishedAt);
  const isoDate =
    publishedAt instanceof Date
      ? publishedAt.toISOString()
      : typeof publishedAt === "string"
        ? publishedAt
        : undefined;
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8 pb-6 border-b border-white/10"
      data-testid="author-byline"
    >
      {author.hasFullProfile && author.avatarPath && (
        <Image
          src={author.avatarPath}
          alt={author.name}
          width={48}
          height={48}
          className="rounded-full object-cover border border-white/15"
          data-testid="img-author-avatar"
        />
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <p className="text-sm text-blue-100/90" data-testid="text-byline">
          <span className="text-blue-200/60">By </span>
          <span className="font-semibold text-white" data-testid="text-author-name">
            {author.name}
          </span>
          <span className="text-blue-200/40 mx-2">|</span>
          <span className="text-blue-200/80" data-testid="text-author-title">
            {author.title}, {author.publisherName}
          </span>
        </p>
        <p className="text-xs text-blue-200/60 flex items-center gap-3 flex-wrap">
          {dateLabel && (
            <>
              <time dateTime={isoDate} data-testid="text-published-date">
                Published: {dateLabel}
              </time>
              {author.hasFullProfile && author.facebookUrl && (
                <span className="text-blue-200/30">|</span>
              )}
            </>
          )}
          {author.hasFullProfile && author.facebookUrl && (
            <span className="flex items-center gap-2">
              <span>Follow {author.name.split(" ")[0]}:</span>
              <a
                href={author.facebookUrl}
                target="_blank"
                rel="noopener noreferrer me"
                className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/5 border border-white/10 hover:bg-blue-600/30 hover:border-blue-400/40 transition-colors"
                aria-label={`Follow ${author.name} on Facebook`}
                data-testid="link-author-facebook"
              >
                <Facebook className="h-3.5 w-3.5 text-blue-300" />
              </a>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

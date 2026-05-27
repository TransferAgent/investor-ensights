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
      className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10"
      data-testid="author-byline"
    >
      {author.avatarPath && (
        <Image
          src={author.avatarPath}
          alt={author.name}
          width={56}
          height={56}
          className="rounded-full object-cover border border-white/15 flex-shrink-0"
          data-testid="img-author-avatar"
        />
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <p
          className="text-sm text-blue-100/90 flex flex-wrap items-center gap-x-2 gap-y-1"
          data-testid="text-byline"
        >
          <span>
            <span className="text-blue-200/60">Author </span>
            <span className="font-semibold text-white" data-testid="text-author-name">
              {author.name}
            </span>
          </span>
          <span className="text-blue-200/40">|</span>
          <span className="text-blue-200/80" data-testid="text-author-title">
            {author.title}, {author.publisherName}
          </span>
          {author.facebookUrl && (
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
          )}
        </p>
        {dateLabel && (
          <time
            dateTime={isoDate}
            className="text-xs text-blue-200/60"
            data-testid="text-published-date"
          >
            Published: {dateLabel}
          </time>
        )}
      </div>
    </div>
  );
}

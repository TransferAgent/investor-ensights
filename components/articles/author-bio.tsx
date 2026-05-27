import Image from "next/image";
import { Linkedin } from "lucide-react";
import type { AuthorConfig } from "@/lib/author-config";

interface AuthorBioProps {
  author: AuthorConfig;
}

export function AuthorBio({ author }: AuthorBioProps) {
  if (!author.hasFullProfile) {
    return null;
  }
  return (
    <aside
      className="mt-12 pt-8 border-t border-white/10"
      data-testid="author-bio"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-200/50 mb-4">
        About the Author
      </h3>
      <div className="flex gap-4 items-start">
        <Image
          src={author.avatarPath}
          alt={author.name}
          width={72}
          height={72}
          className="rounded-full object-cover border border-white/15 flex-shrink-0"
          data-testid="img-bio-avatar"
        />
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-white" data-testid="text-bio-name">
            {author.name}
          </p>
          <p className="text-sm text-blue-200/70 mb-3" data-testid="text-bio-title">
            {author.title}, {author.publisherName}
          </p>
          <p
            className="text-sm text-blue-100/80 leading-relaxed mb-3"
            data-testid="text-bio-body"
          >
            {author.bioHtml}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-200/60">
            <a
              href={`mailto:${author.email}`}
              className="hover:text-blue-300 transition-colors"
              data-testid="link-bio-email"
            >
              {author.email}
            </a>
            <span className="text-blue-200/30">|</span>
            <a
              href={`tel:${author.phone.replace(/[^\d+]/g, "")}`}
              className="hover:text-blue-300 transition-colors"
              data-testid="link-bio-phone"
            >
              {author.phone}
            </a>
            <span className="text-blue-200/30">|</span>
            <a
              href={author.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer me"
              className="inline-flex items-center gap-1 hover:text-blue-300 transition-colors"
              data-testid="link-bio-linkedin"
            >
              <Linkedin className="h-3 w-3" />
              <span>LinkedIn</span>
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}

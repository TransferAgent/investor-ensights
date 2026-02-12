interface TextContent {
  headline?: string
  body: string
}

export function TextSlide({ content, primaryBg }: { content: TextContent; primaryBg?: boolean }) {
  const textClass = primaryBg ? "text-primary-foreground" : ""
  const mutedClass = primaryBg ? "text-primary-foreground/80" : "text-muted-foreground"

  return (
    <div className="max-w-3xl mx-auto">
      {content.headline && (
        <h2 className={`text-3xl font-bold mb-6 ${textClass}`} data-testid="text-block-headline">
          {content.headline}
        </h2>
      )}
      <div className={`prose prose-lg max-w-none dark:prose-invert ${primaryBg ? "prose-invert" : ""}`}>
        {content.body.split("\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </div>
  )
}

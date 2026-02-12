interface ImageTextContent {
  layout?: "image-left" | "image-right"
  headline?: string
  body: string
  image_url: string
  image_alt?: string
}

export function ImageTextSlide({ content }: { content: ImageTextContent }) {
  const isLeft = content.layout !== "image-right"

  return (
    <div className={`flex flex-col gap-8 md:flex-row md:items-center ${!isLeft ? "md:flex-row-reverse" : ""}`}>
      <div className="flex-1">
        <img
          src={content.image_url}
          alt={content.image_alt || ""}
          className="rounded-md w-full h-auto object-cover max-h-96"
          data-testid="img-slide-image"
        />
      </div>
      <div className="flex-1">
        {content.headline && (
          <h2 className="text-3xl font-bold mb-4" data-testid="text-image-text-headline">
            {content.headline}
          </h2>
        )}
        <div className="prose prose-lg max-w-none dark:prose-invert">
          {content.body.split("\n").map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

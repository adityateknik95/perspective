// Skeleton for /lens/[lens]. The query + batched reaction summaries take a
// moment; this keeps the header shape stable so only the feed shimmers in.
export default function LensLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-10 space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-11 w-40 animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-4 w-3/4 animate-pulse rounded-sm bg-cream-deep" />
      </div>

      {/* Lens switcher strip */}
      <div className="mb-10 flex flex-wrap gap-2 border-y border-rule py-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-7 w-16 animate-pulse rounded-sm bg-cream-deep"
          />
        ))}
      </div>

      {/* Perspective cards */}
      <div className="space-y-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 border-b border-rule pb-8">
            <div className="h-[108px] w-[72px] shrink-0 animate-pulse rounded-sm bg-cream-deep" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-40 animate-pulse rounded-sm bg-cream-deep" />
              <div className="h-6 w-2/3 animate-pulse rounded-sm bg-cream-deep" />
              <div className="h-4 w-full animate-pulse rounded-sm bg-cream-deep" />
              <div className="h-4 w-5/6 animate-pulse rounded-sm bg-cream-deep" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

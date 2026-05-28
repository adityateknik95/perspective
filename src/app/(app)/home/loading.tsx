// Skeleton for /home. The Films tab fires three TMDB calls on first paint,
// which can take a beat — without this the user stares at empty cream. The
// shimmer matches the real layout: date masthead, greeting, tab strip, then
// a row of poster placeholders.
export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-10 space-y-3">
        <div className="h-3 w-32 animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-9 w-64 animate-pulse rounded-sm bg-cream-deep" />
      </div>

      {/* Tab strip */}
      <div className="flex gap-8 border-b border-rule pb-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-6 w-20 animate-pulse rounded-sm bg-cream-deep" />
            <div className="h-3 w-24 animate-pulse rounded-sm bg-cream-deep" />
          </div>
        ))}
      </div>

      {/* Poster row */}
      <div className="mt-10 space-y-2">
        <div className="h-3 w-28 animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-7 w-48 animate-pulse rounded-sm bg-cream-deep" />
        <div className="flex gap-4 pt-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-[180px] w-[120px] shrink-0 animate-pulse rounded-sm bg-cream-deep"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FilmLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-10 md:flex-row">
        <div className="h-[480px] w-[320px] animate-pulse bg-cream-deep" />
        <div className="flex-1 space-y-4">
          <div className="h-4 w-12 animate-pulse rounded-sm bg-cream-deep" />
          <div className="h-12 w-3/4 animate-pulse rounded-sm bg-cream-deep" />
          <div className="h-5 w-1/3 animate-pulse rounded-sm bg-cream-deep" />
          <div className="mt-6 h-4 w-1/2 animate-pulse rounded-sm bg-cream-deep" />
          <div className="mt-8 flex gap-3">
            <div className="h-10 w-40 animate-pulse rounded-sm bg-cream-deep" />
            <div className="h-10 w-32 animate-pulse rounded-sm bg-cream-deep" />
          </div>
          <div className="mt-6 h-24 animate-pulse rounded-sm bg-cream-deep" />
        </div>
      </div>
      <div className="mt-16 border-t border-rule pt-10">
        <div className="h-7 w-48 animate-pulse rounded-sm bg-cream-deep" />
        <div className="mt-8 space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-sm bg-cream-deep" />
          ))}
        </div>
      </div>
    </div>
  );
}

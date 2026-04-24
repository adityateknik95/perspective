export default function PerspectiveLoading() {
  return (
    <div className="mx-auto max-w-reading px-6 py-12">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-sm bg-cream-deep" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded-sm bg-cream-deep" />
          <div className="h-3 w-24 animate-pulse rounded-sm bg-cream-deep" />
        </div>
      </div>
      <div className="mt-12 h-14 w-11/12 animate-pulse rounded-sm bg-cream-deep" />
      <div className="mt-3 h-6 w-2/3 animate-pulse rounded-sm bg-cream-deep" />
      <div className="mt-10 h-24 animate-pulse rounded-sm bg-cream-deep" />
      <div className="mt-12 space-y-3">
        <div className="h-4 w-full animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-4 w-11/12 animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-4 w-10/12 animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-4 w-11/12 animate-pulse rounded-sm bg-cream-deep" />
      </div>
    </div>
  );
}

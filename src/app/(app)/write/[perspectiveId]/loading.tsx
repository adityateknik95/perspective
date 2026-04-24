export default function WriteLoading() {
  return (
    <div className="mx-auto max-w-reading px-6 py-10">
      <div className="flex items-center justify-between border-b border-rule pb-4">
        <div className="h-4 w-40 animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-8 w-16 animate-pulse rounded-sm bg-cream-deep" />
      </div>
      <div className="mt-6 h-4 w-2/3 animate-pulse rounded-sm bg-cream-deep" />
      <div className="mt-10 space-y-4">
        <div className="h-12 w-3/4 animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-6 w-1/2 animate-pulse rounded-sm bg-cream-deep" />
      </div>
      <div className="mt-10 space-y-3 border-t border-rule pt-8">
        <div className="h-4 w-full animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-4 w-11/12 animate-pulse rounded-sm bg-cream-deep" />
        <div className="h-4 w-10/12 animate-pulse rounded-sm bg-cream-deep" />
      </div>
    </div>
  );
}

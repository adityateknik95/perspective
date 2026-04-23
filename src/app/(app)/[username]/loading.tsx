export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center gap-6">
        <div className="h-24 w-24 animate-pulse rounded-sm bg-cream-deep" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-1/2 animate-pulse rounded-sm bg-cream-deep" />
          <div className="h-4 w-1/3 animate-pulse rounded-sm bg-cream-deep" />
        </div>
      </div>
      <div className="mt-12 h-px bg-rule" />
      <div className="mt-12 h-5 w-40 animate-pulse rounded-sm bg-cream-deep" />
    </div>
  );
}

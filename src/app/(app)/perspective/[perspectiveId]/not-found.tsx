import Link from "next/link";

export default function PerspectiveNotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="font-mono text-meta-sm uppercase text-ink-muted">404</p>
      <h1 className="mt-6 font-display text-display-md text-ink">
        Nothing here<span className="italic">.</span>
      </h1>
      <p className="mt-4 font-body text-reading text-ink-soft">
        This perspective may have been deleted, kept private, or never existed.
      </p>
      <p className="mt-10 font-mono text-meta-sm uppercase text-ink-muted">
        <Link
          href="/"
          className="text-wine underline-offset-4 hover:underline"
        >
          Back home
        </Link>
      </p>
    </div>
  );
}

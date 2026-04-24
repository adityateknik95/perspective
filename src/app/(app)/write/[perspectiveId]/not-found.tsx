import Link from "next/link";

export default function WriteNotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="font-mono text-meta-sm uppercase text-ink-muted">404</p>
      <h1 className="mt-6 font-display text-display-md text-ink">
        No such draft<span className="italic">.</span>
      </h1>
      <p className="mt-4 font-body text-reading text-ink-soft">
        This draft doesn&apos;t exist, or it isn&apos;t yours to edit.
      </p>
      <p className="mt-10 font-mono text-meta-sm uppercase text-ink-muted">
        <Link
          href="/write/new"
          className="text-wine underline-offset-4 hover:underline"
        >
          Start a new perspective
        </Link>
      </p>
    </div>
  );
}

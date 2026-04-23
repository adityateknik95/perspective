import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="font-mono text-meta-sm uppercase text-ink-muted">404</p>
      <h1 className="mt-6 font-display text-display-md text-ink">
        No one here<span className="italic">.</span>
      </h1>
      <p className="mt-4 font-body text-reading text-ink-soft">
        That username isn&apos;t taken. It could still be yours.
      </p>
      <p className="mt-10 font-mono text-meta-sm uppercase text-ink-muted">
        <Link
          href="/signup"
          className="text-wine underline-offset-4 hover:underline"
        >
          Claim a handle
        </Link>
      </p>
    </div>
  );
}

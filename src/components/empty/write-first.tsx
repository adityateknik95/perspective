import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { pickPrompt } from "@/lib/prompts";
import { promptParts } from "@/lib/prompt-parts";

interface WriteFirstProps {
  // Seeds the prompt so it's stable for a given page (film id, lens, …).
  seed: string;
  // Where "Write" goes: a film-specific /write/new?film= link when there's a
  // film in context, otherwise the film picker. Signed-out visitors are sent
  // through /login by the middleware and land back here afterwards.
  writeHref?: string;
  writeLabel?: string;
  // Optional secondary action (e.g. "Find writers", "See all lenses").
  secondary?: { href: string; label: string };
}

// The call-to-action inside empty states: a writing prompt as an on-ramp,
// then the way in. Used where a list is empty because nobody has written
// yet — the most useful thing the page can do is invite the first piece.
export function WriteFirst({
  seed,
  writeHref = "/write/new",
  writeLabel = "Write a perspective",
  secondary,
}: WriteFirstProps) {
  return (
    <div className="space-y-5">
      <p className="font-display text-reading-lg leading-snug text-ink">
        {promptParts(pickPrompt(seed)).map((part, i) =>
          part.em ? <em key={i}>{part.text}</em> : <span key={i}>{part.text}</span>,
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href={writeHref} className={buttonClassName("primary", "sm")}>
          {writeLabel}
        </Link>
        {secondary && (
          <Link href={secondary.href} className={buttonClassName("secondary", "sm")}>
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}

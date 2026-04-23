import Image from "next/image";
import { cn } from "@/lib/cn";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  // px — matches the <Image /> intrinsic dimensions. Defaults to 40 (menu).
  size?: number;
  // Optional two-letter initial to show when `src` is missing.
  fallback?: string;
  className?: string;
}

// Square-with-slight-radius avatar to keep the editorial mood (no circles).
export function Avatar({
  src,
  alt = "",
  size = 40,
  fallback,
  className,
}: AvatarProps) {
  const initials = (fallback ?? "").trim().slice(0, 2).toUpperCase();

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-sm bg-cream-deep font-mono uppercase text-ink-soft",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
      aria-hidden={!alt ? true : undefined}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <span>{initials || "·"}</span>
      )}
    </span>
  );
}

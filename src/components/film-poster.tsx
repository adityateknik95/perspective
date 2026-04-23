import Image from "next/image";
import { cn } from "@/lib/cn";
import { posterUrl, type PosterSize } from "@/lib/tmdb/urls";

interface FilmPosterProps {
  posterPath: string | null | undefined;
  title: string;
  width: number;
  height: number;
  size?: PosterSize;
  className?: string;
  // Adds a subtle offset drop-shadow behind the poster — editorial, not web-y.
  withShadow?: boolean;
  priority?: boolean;
}

export function FilmPoster({
  posterPath,
  title,
  width,
  height,
  size = "w342",
  className,
  withShadow = false,
  priority = false,
}: FilmPosterProps) {
  const src = posterUrl(posterPath, size);

  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center border border-rule bg-cream-deep font-mono text-meta-sm uppercase text-ink-muted",
          className,
        )}
        style={{ width, height }}
        aria-hidden
      >
        No poster
      </div>
    );
  }

  const img = (
    <Image
      src={src}
      alt={`${title} poster`}
      width={width}
      height={height}
      priority={priority}
      className="block h-full w-full object-cover"
      unoptimized
    />
  );

  if (!withShadow) {
    return <div className={cn(className)} style={{ width, height }}>{img}</div>;
  }

  return (
    <div
      className={cn("relative", className)}
      style={{ width, height }}
    >
      <div
        aria-hidden
        className="absolute inset-0 translate-x-2 translate-y-2 bg-wine/25"
      />
      <div className="relative h-full w-full">{img}</div>
    </div>
  );
}

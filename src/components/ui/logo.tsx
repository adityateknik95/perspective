import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <span
      className={cn(
        "font-display font-normal tracking-tight text-ink",
        className,
      )}
    >
      Perspective<span className="italic">.</span>
    </span>
  );
}

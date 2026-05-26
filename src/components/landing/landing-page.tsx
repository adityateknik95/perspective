"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { Logo } from "@/components/ui/logo";
import { buttonClassName } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LENSES } from "@/lib/lenses";
import { SmoothScroll } from "./smooth-scroll";

// r3f brings a lot of bundle. Load it lazily, client-side only, so the
// landing HTML is painted before three.js touches the wire.
const HeroScene = dynamic(
  () => import("./hero-scene").then((m) => m.HeroScene),
  { ssr: false },
);

export function LandingPage() {
  const reduce = useReducedMotion();

  return (
    <>
      <SmoothScroll />

      <div className="relative overflow-hidden">
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6">
          <Logo className="text-reading-lg sm:text-display-sm" />
          <nav className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <Link
              href="/login"
              className="whitespace-nowrap font-mono text-meta-sm uppercase text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className={buttonClassName("primary", "sm", "whitespace-nowrap")}
            >
              Start writing
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl flex-col justify-center px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
          <HeroScene />

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-mono text-meta-sm uppercase text-ink-muted"
          >
            A journal for film, not a review site
          </motion.p>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="mt-6 max-w-4xl font-display text-display-lg text-ink [text-wrap:balance] sm:text-display-xl md:text-display-2xl"
          >
            How you <span className="italic">saw</span> it, not how you rated it
            <span className="italic">.</span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35 }}
            className="mt-6 max-w-xl font-body text-reading-lg text-ink-soft"
          >
            Perspective is a place to write about films the way you actually
            talk about them — through grief, memory, denial, craft. Filed by
            lens, never by star.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.55 }}
            className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
          >
            <Link
              href="/signup"
              className={buttonClassName("primary", "lg", "justify-center")}
            >
              Start your first entry
            </Link>
            <Link
              href="/login"
              className={buttonClassName("secondary", "lg", "justify-center")}
            >
              I have an account
            </Link>
          </motion.div>
        </section>

        {/* Lenses */}
        <section className="border-t border-rule bg-cream-deep/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <p className="font-mono text-meta-sm uppercase text-ink-muted">
              The lenses
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-display-md text-ink sm:text-display-lg">
              Thirteen ways to file a feeling
              <span className="italic">.</span>
            </h2>
            <p className="mt-5 max-w-prose font-body text-reading text-ink-soft">
              Every journal is tagged with one or more lenses. No five-star
              scale, no thumbs. Just the frame you were watching through.
            </p>

            <motion.ul
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.04 } },
              }}
              className="mt-12 flex flex-wrap gap-3"
            >
              {LENSES.map((lens) => (
                <motion.li
                  key={lens}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  className="border border-rule bg-cream px-4 py-2 font-mono text-meta-sm uppercase text-ink"
                >
                  {lens}
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </section>

        {/* Manifesto */}
        <section className="border-t border-rule">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:gap-16 sm:px-6 sm:py-24 md:grid-cols-2">
            <div>
              <p className="font-mono text-meta-sm uppercase text-ink-muted">
                Why not stars
              </p>
              <h2 className="mt-4 font-display text-display-md text-ink sm:text-display-lg">
                The rating was never the review
                <span className="italic">.</span>
              </h2>
            </div>
            <div className="space-y-6 font-body text-reading text-ink-soft">
              <p>
                Stars flatten a film to a verdict. What matters sits in the
                paragraph after — the scene you couldn&apos;t shake, the
                reason you cried twenty minutes in, the memory it dug up on
                the train home.
              </p>
              <p>
                Perspective is built for that second paragraph. You write.
                You file it under a lens. Your archive becomes a record of
                how you&apos;ve been watching, not a leaderboard.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-rule bg-ink text-cream">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <h2 className="font-display text-display-lg sm:text-display-xl">
              Start one entry
              <span className="italic">.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-prose font-body text-reading text-cream/80">
              You don&apos;t need a plan. You need the last film that moved
              you.
            </p>
            <div className="mt-10">
              <Link
                href="/signup"
                className={buttonClassName(
                  "primary",
                  "lg",
                  "bg-cream text-ink hover:bg-cream-deep",
                )}
              >
                Create your account
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-rule">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 font-mono text-meta-sm uppercase text-ink-muted sm:flex-row sm:items-center sm:px-6">
            <Logo className="text-reading-lg sm:text-display-sm" />
            <Link
              href="/design-system"
              className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Design system
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}

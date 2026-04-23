import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Perspective — a journal for film, not a review site",
  description:
    "A place to write about films the way you actually talk about them — through grief, memory, denial, craft. Filed by lens, never by star.",
};

export default function Home() {
  return <LandingPage />;
}

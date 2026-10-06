import Link from "next/link";
import type { Metadata } from "next";
import { Fill, LegalPage } from "@/components/legal/legal-page";
import { TMDB_NOTICE } from "@/lib/tmdb/attribution";

export const metadata: Metadata = {
  title: "Terms",
  // Draft: keep out of search until reviewed (see legal-page.tsx).
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="[date]">
      <p>
        These terms are an agreement between you and <Fill>operator legal name</Fill> about your
        use of Perspective. By creating an account or using the site you agree to them. Our{" "}
        <Link href="/privacy">Privacy</Link> page explains how we handle your data.
      </p>

      <h2>Who can use Perspective</h2>
      <p>
        You must be at least <Fill>minimum age</Fill> and able to agree to these terms. Keep your
        sign-in details to yourself; you&apos;re responsible for what happens under your account.
      </p>

      <h2>Your writing</h2>
      <p>
        You own what you write. To run Perspective you give us a worldwide, non-exclusive,
        royalty-free licence to store, display and distribute it as the service requires: showing
        your shared pieces to readers, generating link previews, and letting search engines index
        public pieces. The licence ends when you delete the content, except for copies in backups
        until they expire and responses kept as &ldquo;[deleted]&rdquo; so others&apos; replies
        still make sense. Drafts and private pieces are shown to no one but you.
      </p>

      <h2>What&apos;s not allowed</h2>
      <ul>
        <li>Anything illegal, or that infringes someone else&apos;s rights.</li>
        <li>Harassment, threats, hate, or targeting people for who they are.</li>
        <li>Spam, impersonation, or misleading others about who you are.</li>
        <li>Sexual content involving minors, under any circumstances.</li>
        <li>
          Scraping, automated access, or trying to get around security, rate limits, privacy
          settings or moderation.
        </li>
      </ul>

      <h2>Moderation</h2>
      <p>
        Anyone signed in can report a perspective or response. We review reports and may hide
        content or suspend accounts that break these terms. Hidden content stays visible to its
        author, marked as hidden. To ask us to look again, contact{" "}
        <Fill>moderation contact email</Fill>.
      </p>

      <h2>Film information</h2>
      <p>
        Film titles, years, credits and posters come from TMDB. {TMDB_NOTICE} We don&apos;t
        guarantee that film information is accurate or complete.
      </p>

      <h2>Ending things</h2>
      <p>
        You can stop using Perspective and delete your account at any time from{" "}
        <Link href="/settings">Settings</Link>. We may suspend or end access for serious or
        repeated breaches of these terms <Fill>notice / appeal process</Fill>.
      </p>

      <h2>The service is provided as is</h2>
      <p>
        <Fill>
          Warranty disclaimer and limitation of liability — must be written for your jurisdiction
          by counsel; consumer law may limit what can be excluded.
        </Fill>
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms; if a change matters, we&apos;ll update the date above and{" "}
        <Fill>how users will be notified</Fill>. These terms are governed by the laws of{" "}
        <Fill>governing law / jurisdiction</Fill>. Contact: <Fill>contact email</Fill>.
      </p>
    </LegalPage>
  );
}

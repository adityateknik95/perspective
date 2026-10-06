import Link from "next/link";
import type { Metadata } from "next";
import { Fill, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  // Draft: keep out of search until reviewed (see legal-page.tsx).
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="[date]">
      <p>
        Perspective is run by <Fill>operator legal name</Fill> (&ldquo;we&rdquo;). This page
        explains what we collect when you use Perspective, why, who else handles it, and how
        to delete it. Questions: <Fill>privacy contact email</Fill>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your email address and a password (stored as a hash by our
          authentication provider, never readable by us). If you sign in with Google, we receive
          your Google account email and name.
        </li>
        <li>
          <strong>Profile:</strong> username, display name, bio, signature lenses, avatar image,
          and whether your profile is private.
        </li>
        <li>
          <strong>What you write and do:</strong> perspectives (including drafts), responses,
          reactions, resonances, who you follow, and reports you file.
        </li>
        <li>
          <strong>Technical data:</strong> your IP address, used briefly to limit abuse (for
          example, repeated sign-in attempts) and present in our hosting provider&apos;s request
          logs. When we use a shared rate-limit store, it holds only one-way hashes of these
          values, never the addresses themselves.
        </li>
      </ul>
      <p>
        We don&apos;t run analytics, advertising or tracking scripts, and we don&apos;t sell or
        share your data for advertising.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        We set only the cookies needed to keep you signed in (session cookies from our
        authentication provider). Your light/dark theme choice is kept in your browser&apos;s
        local storage and never sent to us.
      </p>

      <h2>Who can see what</h2>
      <ul>
        <li>
          <strong>Shared, public perspectives</strong> can be read by anyone, may appear in
          search engines and in link previews (share cards) when someone shares the link.
        </li>
        <li>
          <strong>Drafts and private perspectives</strong> are visible only to you.
        </li>
        <li>
          <strong>If your profile is private</strong>, your profile and all your perspectives are
          visible only to you. Responses you leave on other people&apos;s public pieces stay
          visible there, with your name and avatar.
        </li>
        <li>Who you follow, and reaction counts on public pieces, are public.</li>
        <li>
          <strong>Moderators</strong> can see reported content, including content that has been
          hidden, in order to review reports.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <p>
        To run the service you asked for (your account, your writing, the social features), to
        keep it secure and free of abuse, to review reports, and to find and fix errors. Our
        legal basis for this is <Fill>e.g. performance of a contract / legitimate interests —
        confirm with counsel for your jurisdictions</Fill>.
      </p>

      <h2>Who processes it for us</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication and file storage. Region:{" "}
          <Fill>Supabase project region</Fill>.
        </li>
        <li>
          <strong>Vercel</strong> — hosting; keeps request logs for <Fill>log retention</Fill>.
        </li>
        <li>
          <strong>Upstash</strong> — rate limiting, if enabled; stores hashed keys that expire
          within an hour.
        </li>
        <li>
          <strong>Google</strong> — only if you choose to sign in with Google.
        </li>
        <li>
          <strong>TMDB</strong> — film information. Our servers send film searches to TMDB; we
          don&apos;t send TMDB anything that identifies you.
        </li>
        <li>
          <strong>Error reporting</strong> — when something breaks, a short technical report
          (which may include your account id, never your writing) is sent to{" "}
          <Fill>error webhook destination, or remove if unused</Fill>.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Until you delete it. You can delete individual pieces and responses at any time, and
        delete your whole account from <Link href="/settings">Settings</Link>. Deleting your
        account removes your profile, avatar, perspectives (including drafts), reactions,
        responses, follows, notifications and the reports you filed. If someone replied to one
        of your responses, that response is kept as &ldquo;[deleted]&rdquo; with no link to you,
        so their reply still makes sense. Backups may hold deleted data for up to{" "}
        <Fill>backup retention period</Fill> before they expire.
      </p>

      <h2>Your rights</h2>
      <p>
        You can see and correct your profile in Settings and delete your account at any time.
        To request a copy of your data, or to exercise any other right you have under the law
        where you live, email <Fill>privacy contact email</Fill>.{" "}
        <Fill>Add jurisdiction-specific rights (e.g. GDPR, UK GDPR, CCPA) after review</Fill>
      </p>

      <h2>Children</h2>
      <p>
        Perspective isn&apos;t for anyone under <Fill>minimum age</Fill>. If you believe a child
        has created an account, contact us and we&apos;ll delete it.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we&apos;ll update the date above and{" "}
        <Fill>how users will be notified</Fill>.
      </p>
    </LegalPage>
  );
}

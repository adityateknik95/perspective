import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Design system",
};

const colors = [
  { name: "cream", hex: "#F2EBDD", note: "background" },
  { name: "cream-deep", hex: "#E8DFCC", note: "surface" },
  { name: "ink", hex: "#1A1512", note: "primary text" },
  { name: "ink-soft", hex: "#3A322C", note: "secondary text" },
  { name: "ink-muted", hex: "#6B5E52", note: "tertiary text" },
  { name: "wine", hex: "#6B1F2B", note: "accent · brand" },
  { name: "wine-deep", hex: "#4A1520", note: "accent hover" },
  { name: "rule", hex: "#C9BEA8", note: "borders · dividers" },
];

const displaySizes = [
  { className: "text-display-2xl", label: "Display 2xl · 72px" },
  { className: "text-display-xl", label: "Display xl · 56px" },
  { className: "text-display-lg", label: "Display lg · 44px" },
  { className: "text-display-md", label: "Display md · 36px" },
  { className: "text-display-sm", label: "Display sm · 28px" },
];

const bodySizes = [
  { className: "text-reading-lg", label: "Reading lg · 20px · long-form" },
  { className: "text-reading", label: "Reading · 18px · default" },
  { className: "text-reading-sm", label: "Reading sm · 16px" },
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-12 border-b border-rule pb-8">
        <p className="font-mono text-meta uppercase text-ink-muted">
          Perspective
        </p>
        <h1 className="mt-4 font-display text-display-md text-ink sm:text-display-lg">
          Design system
        </h1>
        <p className="mt-4 max-w-prose font-body text-reading text-ink-soft">
          Developer-facing reference. Every color token, type size, and button
          variant used in the product, on one page.
        </p>
      </header>

      <Section title="Logo">
        <div className="flex flex-wrap items-baseline gap-10">
          <Logo className="text-display-lg" />
          <Logo className="text-display-md" />
          <Logo className="text-display-sm" />
          <Logo className="text-reading-lg" />
        </div>
      </Section>

      <Section title="Color">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {colors.map((c) => (
            <div key={c.name} className="border border-rule">
              <div
                className="aspect-[4/3] border-b border-rule"
                style={{ backgroundColor: c.hex }}
              />
              <div className="px-3 py-2">
                <p className="font-mono text-meta-sm uppercase text-ink">
                  {c.name}
                </p>
                <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-muted">
                  {c.hex} · {c.note}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Display · Fraunces">
        <div className="space-y-8">
          {displaySizes.map((d) => (
            <div key={d.className}>
              <p className="font-mono text-meta-sm uppercase text-ink-muted">
                {d.label}
              </p>
              <p className={`mt-2 font-display ${d.className} text-ink`}>
                A place for how you saw it
                <span className="italic">.</span>
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Body · Newsreader">
        <div className="space-y-8">
          {bodySizes.map((b) => (
            <div key={b.className}>
              <p className="font-mono text-meta-sm uppercase text-ink-muted">
                {b.label}
              </p>
              <p
                className={`mt-2 font-body ${b.className} max-w-prose text-ink-soft`}
              >
                The film did not move me the way it was supposed to. Instead I
                kept thinking about my mother, how she would have watched this
                scene from the kitchen doorway, dishcloth in hand, saying
                nothing &mdash; and that became the only thing I could see.
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Meta · JetBrains Mono">
        <div className="space-y-3">
          <p className="font-mono text-meta uppercase text-ink">
            Meta · 13px · 0.15em
          </p>
          <p className="font-mono text-meta-sm uppercase text-ink">
            Meta sm · 11px · 0.18em
          </p>
          <p className="font-mono text-meta uppercase text-ink-muted">
            Posted 3 days ago · 8 min read
          </p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="space-y-10">
          <Row label="Primary">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </Row>
          <Row label="Secondary">
            <Button variant="secondary" size="sm">
              Small
            </Button>
            <Button variant="secondary" size="md">
              Medium
            </Button>
            <Button variant="secondary" size="lg">
              Large
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </Row>
          <Row label="Ghost">
            <Button variant="ghost" size="sm">
              Small
            </Button>
            <Button variant="ghost" size="md">
              Medium
            </Button>
            <Button variant="ghost" size="lg">
              Large
            </Button>
          </Row>
          <Row label="Link">
            <Button variant="link">Read the full perspective</Button>
          </Row>
        </div>
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule py-12 last:border-b-0">
      <h2 className="mb-8 font-mono text-meta uppercase text-ink-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 font-mono text-meta-sm uppercase text-ink-muted">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

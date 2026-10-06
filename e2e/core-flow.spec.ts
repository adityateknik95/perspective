import { expect, test, type Page } from "@playwright/test";
import {
  E2E_EMAIL_DOMAIN,
  cleanupUsers,
  confirmEmail,
  createOnboardedUser,
  seedFilm,
  uniqueSuffix,
} from "./support/admin";

// The core loop of the product, end to end, through the real UI:
//
//   writer: sign up → confirm → sign in → onboard → write → share
//   reader: open the shared piece → react → respond
//   writer: sees the reader's response notification
//
// Steps share state (the writer's account, the shared piece's URL), so the
// file runs serially; a failure stops the story where it broke.

test.describe.configure({ mode: "serial" });

const suffix = uniqueSuffix();
const writer = {
  username: `w${suffix}`,
  email: `w${suffix}@${E2E_EMAIL_DOMAIN}`,
  password: `Writer-${suffix}-pw!`,
  displayName: "E2E Writer",
};
const pieceTitle = `What the rain kept ${suffix}`;
const responseText = `This stayed with me too (${suffix}).`;

let filmTmdbId: number;
let pieceUrl: string;
let reader: { id: string; email: string; password: string };

test.beforeAll(async () => {
  filmTmdbId = await seedFilm();
  reader = await createOnboardedUser(`r${suffix}`, "E2E Reader");
});

test.afterAll(async () => {
  await cleanupUsers();
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login")),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
}

test("writer signs up", async ({ page }) => {
  // networkidle ≈ hydrated: input typed before hydration lands in the DOM
  // but never reaches React's state, which a person can't do.
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(writer.email);
  await page.getByLabel("Username").fill(writer.username);
  // The live availability check gates the submit button.
  await expect(page.getByText("Available.")).toBeVisible();
  await page.getByLabel("Password").fill(writer.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();

  // The verification email's link, without an inbox.
  await confirmEmail(writer.email);
});

test("writer signs in and onboards", async ({ page }) => {
  await signIn(page, writer.email, writer.password);
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel("Display name").fill(writer.displayName);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Bio").fill("Writes about weather in films.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: /memory/i }).click();
  await page.getByRole("button", { name: "Finish" }).click();

  await expect(page).toHaveURL(new RegExp(`/${writer.username}$`));
  await expect(page.getByText(writer.displayName).first()).toBeVisible();
});

test("writer writes and shares a perspective", async ({ page }) => {
  await signIn(page, writer.email, writer.password);

  // /write/new?film= creates the draft and redirects into the editor.
  await page.goto(`/write/new?film=${filmTmdbId}`, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/write\/[0-9a-f-]{36}$/);

  // exact: a substring match would also hit "Subtitle (optional)".
  await page.getByPlaceholder("Title", { exact: true }).fill(pieceTitle);
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("The rain in the last scene sounded like my grandmother's kitchen.");
  // Autosave lands (debounced) before we share.
  await expect(page.getByText(/^Saved/)).toBeVisible();

  await page.getByRole("button", { name: "Share…" }).click();
  const panel = page.getByRole("region", { name: "Share this perspective" }).or(
    page.getByLabel("Share this perspective"),
  );
  await panel.getByRole("checkbox", { name: /memory/i }).click();
  await panel.getByRole("button", { name: "Share", exact: true }).click();

  await expect(page).toHaveURL(/\/perspective\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(pieceTitle);
  pieceUrl = new URL(page.url()).pathname;
});

test("a reader reacts and responds", async ({ browser }) => {
  // Separate context = separate cookies: a genuinely different person.
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, reader.email, reader.password);

  await page.goto(pieceUrl);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(pieceTitle);

  const moved = page.getByRole("radio", { name: "Moved" });
  await moved.click();
  await expect(moved).toHaveAttribute("aria-checked", "true");

  await page.getByLabel("Response body").fill(responseText);
  await page.getByRole("button", { name: "Respond", exact: true }).click();
  await expect(page.getByText(responseText)).toBeVisible();

  // Both survive a reload, i.e. they're in the database, not just in
  // optimistic client state.
  await page.reload();
  await expect(page.getByRole("radio", { name: "Moved" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(responseText)).toBeVisible();

  await context.close();
});

test("the writer sees the response", async ({ page }) => {
  await signIn(page, writer.email, writer.password);

  await page.goto(pieceUrl);
  await expect(page.getByText(responseText)).toBeVisible();

  await page.goto("/notifications");
  await expect(page.getByText("E2E Reader").first()).toBeVisible();
});

test("every page carries the TMDB attribution", async ({ page }) => {
  await page.goto(pieceUrl, { waitUntil: "networkidle" });
  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByText("This product uses the TMDB API but is not endorsed or certified by TMDB."),
  ).toBeVisible();

  // The logo is either the real file or absent — never a broken image.
  // (public/tmdb-logo.svg isn't committed; see README → Launch checklist.)
  const logos = footer.locator('img[alt="TMDB"]');
  for (const logo of await logos.all()) {
    expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }
});

import { z } from "zod";
import { usernameSchema } from "./username";
import {
  LENSES,
  MAX_SIGNATURE_LENSES,
  MIN_SIGNATURE_LENSES,
  type Lens,
} from "@/lib/lenses";

// Bio matches the DB check constraint (<= 240 chars). We also trim and treat
// an empty string as "no bio" (null in the DB).
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Pick a display name.")
  .max(60, "60 characters max.");

// Bio is optional on the wire. Empty-string vs null coercion happens in the
// server action (not here) so the schema output type stays symmetric with
// react-hook-form's input type — avoids a known headache when mixing zod
// transforms with useForm<T>.
export const bioSchema = z
  .string()
  .trim()
  .max(240, "240 characters max.")
  .optional();

const lensEnum = z.enum(LENSES as readonly [Lens, ...Lens[]]);

export const signatureLensesSchema = z
  .array(lensEnum)
  .min(MIN_SIGNATURE_LENSES, "Pick at least one lens.")
  .max(MAX_SIGNATURE_LENSES, `Pick at most ${MAX_SIGNATURE_LENSES}.`);

// Onboarding: user has an auth row but no profile fields yet. Username is set
// at signup, so onboarding collects the rest.
export const onboardingSchema = z.object({
  display_name: displayNameSchema,
  bio: bioSchema,
  signature_lenses: signatureLensesSchema,
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

// Settings lets the user edit everything that's safe to edit from a form.
// Avatar upload is a separate action (file input), not part of this schema.
export const settingsSchema = z.object({
  username: usernameSchema,
  display_name: displayNameSchema,
  bio: bioSchema,
  signature_lenses: signatureLensesSchema,
  is_private: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

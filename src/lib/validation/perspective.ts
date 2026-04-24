import { z } from "zod";
import {
  LENSES,
  MAX_PERSPECTIVE_LENSES,
  MIN_PERSPECTIVE_LENSES,
  type Lens,
} from "@/lib/lenses";

// Two schemas here, same shape-family:
//   - saveDraftSchema  — what autosave accepts. Title can be empty mid-write.
//   - publishSchema    — what it takes to flip is_draft → false. Title,
//                        body, and at least one lens become mandatory.
//
// Keep schemas symmetric with react-hook-form types: don't use .transform()
// so the inferred input type matches the resolver output type.

const titleOptional = z
  .string()
  .max(120, "Title must be 120 characters or fewer.")
  .optional();

const titleRequired = z
  .string()
  .trim()
  .min(1, "Give it a title.")
  .max(120, "Title must be 120 characters or fewer.");

const subtitle = z
  .string()
  .max(200, "Subtitle must be 200 characters or fewer.")
  .optional();

// HTML body. We don't validate its shape here — sanitize-html is the sole
// authority on allowed markup server-side. Just cap total size to prevent
// accidental megabyte uploads.
const bodyHtml = z
  .string()
  .max(200_000, "The body is too long.")
  .optional();

const lensEnum = z.enum(LENSES as readonly [Lens, ...Lens[]]);

export const saveDraftSchema = z.object({
  title: titleOptional,
  subtitle: subtitle,
  body: bodyHtml,
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export const publishSchema = z.object({
  title: titleRequired,
  subtitle: subtitle,
  body: bodyHtml,
  lens_tags: z
    .array(lensEnum)
    .min(MIN_PERSPECTIVE_LENSES, "Pick at least one lens.")
    .max(
      MAX_PERSPECTIVE_LENSES,
      `Pick at most ${MAX_PERSPECTIVE_LENSES}.`,
    ),
  is_private: z.boolean(),
});
export type PublishInput = z.infer<typeof publishSchema>;

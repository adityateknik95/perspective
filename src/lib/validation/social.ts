import { z } from "zod";
import { REACTION_TYPES } from "@/lib/social/reactions";

// UUIDs are how we reference perspectives, responses, etc on the wire.
// Validating shape early means a malformed id never touches Postgres.
const uuid = z.string().uuid("Invalid id.");

// -----------------------------------------------------------------------------
// Reactions
// -----------------------------------------------------------------------------

export const reactionTypeSchema = z.enum(REACTION_TYPES);

// `null` clears the user's reaction. The server action treats this as a
// DELETE rather than an upsert.
export const setReactionSchema = z.object({
  perspectiveId: uuid,
  reactionType: reactionTypeSchema.nullable(),
});

export type SetReactionInput = z.infer<typeof setReactionSchema>;

// -----------------------------------------------------------------------------
// Responses
// -----------------------------------------------------------------------------

// Mirrors the DB CHECK on responses.body (1-2000 chars). Trim first so a
// user can't sneak past min=1 with whitespace.
export const responseBodySchema = z
  .string()
  .trim()
  .min(1, "Response can't be empty.")
  .max(2000, "Response is over 2000 characters.");

export const createResponseSchema = z.object({
  perspectiveId: uuid,
  // Top-level responses omit this; replies set it. The action enforces the
  // "one level only" rule by rejecting a parentResponseId whose own
  // parent_response_id is non-null.
  parentResponseId: uuid.nullable().optional(),
  body: responseBodySchema,
});

export type CreateResponseInput = z.infer<typeof createResponseSchema>;

// -----------------------------------------------------------------------------
// Follows
// -----------------------------------------------------------------------------

// Username (not id) on the wire — keeps URLs and UI clean. The server
// action resolves to a profile id and rejects self-follow.
export const followUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]{3,20}$/, "Invalid username."),
});

// -----------------------------------------------------------------------------
// Reports
// -----------------------------------------------------------------------------

export const createReportSchema = z.object({
  targetType: z.enum(["perspective", "response"]),
  targetId: uuid,
  reason: z
    .string()
    .trim()
    .min(1, "Tell us why.")
    .max(500, "Keep it under 500 characters."),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

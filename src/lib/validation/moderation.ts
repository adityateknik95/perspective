import { z } from "./zod";

// Shared between the admin page (client buttons) and its server actions.
export const moderationTargetSchema = z.object({
  targetType: z.enum(["perspective", "response"]),
  targetId: z.string().uuid("Invalid id."),
});

export type ModerationTarget = z.infer<typeof moderationTargetSchema>;

import { z } from "zod";
import { isReservedUsername } from "@/lib/reserved-usernames";

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters.")
  .max(20, "20 characters max.")
  .regex(USERNAME_REGEX, "Lowercase letters, numbers, and underscore only.")
  .refine((u) => !isReservedUsername(u), "That username is reserved.");

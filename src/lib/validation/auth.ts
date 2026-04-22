import { z } from "zod";
import { usernameSchema } from "./username";

// Passwords: 8-72 chars (bcrypt truncates anything past 72 bytes).
const passwordSchema = z
  .string()
  .min(8, "At least 8 characters.")
  .max(72, "72 characters max.");

export const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: passwordSchema,
  username: usernameSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

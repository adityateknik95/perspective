"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { resetPasswordAction } from "./actions";

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("password", values.password);
      formData.append("confirmPassword", values.confirmPassword);
      const result = await resetPasswordAction(formData);
      if (result && !result.ok) {
        if (result.fieldErrors) {
          for (const [name, msg] of Object.entries(result.fieldErrors)) {
            setError(name as keyof ResetPasswordInput, { message: msg });
          }
        }
        setFormError(result.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-display-md text-ink">
          Choose a new password<span className="italic">.</span>
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          <FieldError
            id="password-error"
            message={errors.password?.message}
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.confirmPassword}
            aria-describedby={
              errors.confirmPassword ? "confirmPassword-error" : undefined
            }
            {...register("confirmPassword")}
          />
          <FieldError
            id="confirmPassword-error"
            message={errors.confirmPassword?.message}
          />
        </div>

        {formError && (
          <p
            role="alert"
            className="font-mono text-meta-sm uppercase text-wine"
          >
            {formError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="w-full"
        >
          {isPending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </div>
  );
}

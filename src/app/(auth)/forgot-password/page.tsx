"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", values.email);
      const result = await forgotPasswordAction(formData);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [name, msg] of Object.entries(result.fieldErrors)) {
            setError(name as keyof ForgotPasswordInput, { message: msg });
          }
        }
        setFormError(result.error);
        return;
      }
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-display-md text-ink">
          Check your email<span className="italic">.</span>
        </h1>
        <p className="font-body text-reading text-ink-soft">
          If an account exists for that address, a reset link is on its way.
        </p>
        <p className="font-mono text-meta-sm uppercase text-ink-muted">
          <Link
            href="/login"
            className="text-wine underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-display-md text-ink">
          Reset password<span className="italic">.</span>
        </h1>
        <p className="mt-3 font-body text-reading text-ink-soft">
          Enter your email and we&apos;ll send a link to choose a new one.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          <FieldError id="email-error" message={errors.email?.message} />
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
          {isPending ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="font-mono text-meta-sm uppercase text-ink-muted">
        <Link
          href="/login"
          className="text-wine underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

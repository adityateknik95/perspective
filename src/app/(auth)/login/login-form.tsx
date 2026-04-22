"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { GoogleButton } from "@/components/auth/google-button";
import { loginAction } from "./actions";

interface LoginFormProps {
  next?: string;
  oauthError?: string;
}

export function LoginForm({ next, oauthError }: LoginFormProps) {
  const nextUrl = next && next.startsWith("/") ? next : "/";
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(
    oauthError ? "Sign-in failed. Try again." : null,
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", values.email);
      formData.append("password", values.password);
      formData.append("next", nextUrl);

      const result = await loginAction(formData);

      // A successful sign-in redirects on the server side, so we only reach
      // this branch on failure.
      if (result && !result.ok) {
        if (result.fieldErrors) {
          for (const [name, msg] of Object.entries(result.fieldErrors)) {
            setError(name as keyof LoginInput, { message: msg });
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
          Welcome back<span className="italic">.</span>
        </h1>
      </div>

      <GoogleButton next={nextUrl}>Sign in with Google</GoogleButton>

      <div className="flex items-center gap-4">
        <hr className="flex-1 border-rule" />
        <span className="font-mono text-meta-sm uppercase text-ink-muted">
          or
        </span>
        <hr className="flex-1 border-rule" />
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

        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="font-mono text-meta-sm uppercase text-wine underline-offset-4 hover:underline"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          <FieldError
            id="password-error"
            message={errors.password?.message}
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
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="font-mono text-meta-sm uppercase text-ink-muted">
        New here?{" "}
        <Link
          href="/signup"
          className="text-wine underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

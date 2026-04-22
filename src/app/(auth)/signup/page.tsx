"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { USERNAME_REGEX } from "@/lib/validation/username";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { GoogleButton } from "@/components/auth/google-button";
import { signupAction } from "./actions";

type CheckStatus =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "error";

export default function SignupPage() {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [checkStatus, setCheckStatus] = useState<CheckStatus>("idle");
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
  });

  const usernameValue = watch("username");

  useEffect(() => {
    if (!usernameValue) {
      setCheckStatus("idle");
      setCheckMessage(null);
      return;
    }

    const normalized = usernameValue.trim().toLowerCase();
    if (!USERNAME_REGEX.test(normalized)) {
      setCheckStatus("idle");
      setCheckMessage(null);
      return;
    }

    setCheckStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/username-available?username=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setCheckStatus("error");
          setCheckMessage("Couldn't check — try again.");
          return;
        }
        const json = (await res.json()) as {
          available: boolean;
          reason?: string;
        };
        if (json.available) {
          setCheckStatus("available");
          setCheckMessage("Available.");
        } else {
          setCheckStatus("unavailable");
          setCheckMessage(
            json.reason === "reserved" ? "Reserved." : "Already taken.",
          );
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setCheckStatus("error");
        setCheckMessage("Couldn't check — try again.");
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [usernameValue]);

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", values.email);
      formData.append("password", values.password);
      formData.append("username", values.username);

      const result = await signupAction(formData);

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [name, msg] of Object.entries(result.fieldErrors)) {
            setError(name as keyof SignupInput, { message: msg });
          }
        }
        setFormError(result.error);
        return;
      }

      setSubmittedEmail(result.data?.email ?? values.email);
    });
  }

  if (submittedEmail) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-display-md text-ink">
          Check your email<span className="italic">.</span>
        </h1>
        <p className="font-body text-reading text-ink-soft">
          We sent a confirmation link to{" "}
          <span className="font-mono text-meta uppercase text-ink">
            {submittedEmail}
          </span>
          . Open it to finish creating your account.
        </p>
        <p className="font-mono text-meta-sm uppercase text-ink-muted">
          Wrong address?{" "}
          <Link
            href="/signup"
            className="text-wine underline-offset-4 hover:underline"
          >
            Try again
          </Link>
        </p>
      </div>
    );
  }

  const usernameInvalid =
    !!errors.username ||
    checkStatus === "unavailable" ||
    checkStatus === "error";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-display-md text-ink">
          Start writing<span className="italic">.</span>
        </h1>
        <p className="mt-3 font-body text-reading text-ink-soft">
          Film journals, not film reviews.
        </p>
      </div>

      <GoogleButton next="/onboarding">Sign up with Google</GoogleButton>

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
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            invalid={usernameInvalid}
            aria-describedby="username-feedback"
            {...register("username")}
          />
          <p
            id="username-feedback"
            aria-live="polite"
            className={`min-h-[1.25rem] pt-1 font-mono text-meta-sm uppercase ${
              errors.username || usernameInvalid
                ? "text-wine"
                : checkStatus === "available"
                  ? "text-ink-soft"
                  : "text-ink-muted"
            }`}
          >
            {errors.username?.message ??
              (checkStatus === "checking"
                ? "Checking…"
                : (checkMessage ?? "\u00a0"))}
          </p>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
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
          disabled={isPending || checkStatus === "checking"}
          className="w-full"
        >
          {isPending ? "Creating…" : "Create account"}
        </Button>
      </form>

      <p className="font-mono text-meta-sm uppercase text-ink-muted">
        Already here?{" "}
        <Link
          href="/login"
          className="text-wine underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

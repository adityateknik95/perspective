"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/validation/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { LensChip } from "@/components/ui/lens-chip";
import {
  LENSES,
  MAX_SIGNATURE_LENSES,
  type Lens,
} from "@/lib/lenses";
import { completeOnboardingAction } from "./actions";

type Step = 0 | 1 | 2;

interface OnboardingFormProps {
  initialDisplayName: string;
}

// Three visual steps, one submission. We validate only the fields for the
// current step when advancing; the real schema runs on submit + server-side.
export function OnboardingForm({ initialDisplayName }: OnboardingFormProps) {
  const [step, setStep] = useState<Step>(0);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    control,
    setError,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    mode: "onBlur",
    defaultValues: {
      display_name: initialDisplayName,
      bio: "",
      signature_lenses: [],
    },
  });

  async function next() {
    const ok = await trigger(
      step === 0 ? "display_name" : step === 1 ? "bio" : "signature_lenses",
    );
    if (!ok) return;
    setStep((s) => (s < 2 ? ((s + 1) as Step) : s));
  }

  function onSubmit(values: OnboardingInput) {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("display_name", values.display_name);
      if (values.bio) formData.append("bio", values.bio);
      for (const lens of values.signature_lenses) {
        formData.append("signature_lenses", lens);
      }
      const result = await completeOnboardingAction(formData);
      if (result && !result.ok) {
        if (result.fieldErrors) {
          for (const [name, msg] of Object.entries(result.fieldErrors)) {
            setError(name as keyof OnboardingInput, { message: msg });
          }
        }
        setFormError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10" noValidate>
      <Stepper step={step} />

      {step === 0 && (
        <section className="space-y-5">
          <Heading>What should we call you?</Heading>
          <p className="font-body text-reading text-ink-soft">
            Your display name is what readers see. You can change it any time.
          </p>
          <div>
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              autoComplete="name"
              invalid={!!errors.display_name}
              aria-describedby={
                errors.display_name ? "display_name-error" : undefined
              }
              {...register("display_name")}
            />
            <FieldError
              id="display_name-error"
              message={errors.display_name?.message}
            />
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <Heading>A line about how you watch.</Heading>
          <p className="font-body text-reading text-ink-soft">
            Optional. A sentence, a confession, a warning — up to 240 characters.
          </p>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={3}
              invalid={!!errors.bio}
              aria-describedby={errors.bio ? "bio-error" : undefined}
              {...register("bio")}
            />
            <FieldError id="bio-error" message={errors.bio?.message} />
          </div>
        </section>
      )}

      {step === 2 && (
        <Controller
          control={control}
          name="signature_lenses"
          render={({ field }) => {
            const selected = new Set<Lens>(field.value ?? []);
            const toggle = (lens: Lens) => {
              const nextSet = new Set(selected);
              if (nextSet.has(lens)) nextSet.delete(lens);
              else if (nextSet.size < MAX_SIGNATURE_LENSES) nextSet.add(lens);
              field.onChange(Array.from(nextSet));
            };
            const atMax = selected.size >= MAX_SIGNATURE_LENSES;

            return (
              <section className="space-y-5">
                <Heading>Your signature lenses.</Heading>
                <p className="font-body text-reading text-ink-soft">
                  Pick one to three. These become the default way your journals
                  are filed.
                </p>
                <div
                  role="group"
                  aria-label="Signature lenses"
                  className="flex flex-wrap gap-2"
                >
                  {LENSES.map((lens) => (
                    <LensChip
                      key={lens}
                      lens={lens}
                      selected={selected.has(lens)}
                      disabled={atMax && !selected.has(lens)}
                      onToggle={toggle}
                    />
                  ))}
                </div>
                <FieldError message={errors.signature_lenses?.message} />
              </section>
            );
          }}
        />
      )}

      {formError && (
        <p
          role="alert"
          className="font-mono text-meta-sm uppercase text-wine"
        >
          {formError}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-rule pt-6">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))}
          disabled={step === 0 || isPending}
        >
          Back
        </Button>

        {step < 2 ? (
          <Button type="button" size="md" onClick={next}>
            Continue
          </Button>
        ) : (
          <Button type="submit" size="md" disabled={isPending}>
            {isPending ? "Saving…" : "Finish"}
          </Button>
        )}
      </div>
    </form>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-display-md text-ink">
      {children}
      <span className="italic">.</span>
    </h2>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex items-center gap-3 font-mono text-meta-sm uppercase text-ink-muted">
      {(["name", "bio", "lenses"] as const).map((label, i) => (
        <li key={label} className="flex items-center gap-3">
          <span
            className={
              i === step
                ? "text-wine"
                : i < step
                  ? "text-ink-soft"
                  : "text-ink-muted"
            }
          >
            {String(i + 1).padStart(2, "0")} · {label}
          </span>
          {i < 2 && <span aria-hidden>·</span>}
        </li>
      ))}
    </ol>
  );
}

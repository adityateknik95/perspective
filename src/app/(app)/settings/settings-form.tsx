"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  settingsSchema,
  type SettingsInput,
} from "@/lib/validation/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { Avatar } from "@/components/ui/avatar";
import { LensChip } from "@/components/ui/lens-chip";
import {
  LENSES,
  MAX_SIGNATURE_LENSES,
  type Lens,
} from "@/lib/lenses";
import { updateSettingsAction, uploadAvatarAction } from "./actions";

interface SettingsFormProps {
  initial: SettingsInput & { avatar_url: string | null };
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatar_url);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    mode: "onBlur",
    defaultValues: initial,
  });

  // Live username availability feedback. We only query when the value has
  // actually changed vs. what the user currently owns, and cancel in-flight
  // requests on each keystroke.
  const watchedUsername = watch("username");
  const [availability, setAvailability] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid" | "error"
  >("idle");

  useEffect(() => {
    const candidate = (watchedUsername ?? "").trim().toLowerCase();
    if (!candidate || candidate === initial.username) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/username-available?username=${encodeURIComponent(candidate)}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as {
          available: boolean | null;
          reason?: string;
        };
        if (data.available === true) setAvailability("available");
        else if (data.reason === "format" || data.reason === "reserved")
          setAvailability("invalid");
        else if (data.reason === "taken") setAvailability("taken");
        else setAvailability("error");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setAvailability("error");
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [watchedUsername, initial.username]);

  function onSubmit(values: SettingsInput) {
    setFormError(null);
    setSaved(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("username", values.username);
      formData.append("display_name", values.display_name);
      if (values.bio) formData.append("bio", values.bio);
      for (const lens of values.signature_lenses) {
        formData.append("signature_lenses", lens);
      }
      if (values.is_private) formData.append("is_private", "on");

      const result = await updateSettingsAction(formData);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [name, msg] of Object.entries(result.fieldErrors)) {
            setError(name as keyof SettingsInput, { message: msg });
          }
        }
        setFormError(result.error);
        return;
      }
      setSaved(true);
      // Refresh the header avatar/display name.
      router.refresh();
    });
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    const formData = new FormData();
    formData.append("avatar", file);
    const result = await uploadAvatarAction(formData);
    setAvatarUploading(false);
    if (!result.ok) {
      setAvatarError(result.error);
      return;
    }
    setAvatarUrl(result.data?.url ?? null);
    router.refresh();
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="font-display text-display-sm text-ink">
          Avatar
        </h2>
        <div className="flex items-center gap-6">
          <Avatar
            src={avatarUrl}
            size={88}
            fallback={initial.display_name || initial.username}
          />
          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center gap-3 border border-rule px-4 py-2 font-mono text-meta-sm uppercase text-ink-soft transition-colors hover:border-ink-soft hover:bg-cream-deep">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onAvatarChange}
                disabled={avatarUploading}
                className="sr-only"
              />
              {avatarUploading ? "Uploading…" : "Change photo"}
            </label>
            {avatarError && (
              <p className="font-mono text-meta-sm uppercase text-wine">
                {avatarError}
              </p>
            )}
            <p className="font-mono text-meta-sm uppercase text-ink-muted">
              JPG, PNG, or WebP · up to 5 MB
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
        <section className="space-y-5">
          <h2 className="font-display text-display-sm text-ink">
            Profile
          </h2>

          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              invalid={!!errors.username || availability === "taken" || availability === "invalid"}
              aria-describedby="username-status"
              {...register("username")}
            />
            <FieldError
              id="username-status"
              message={
                errors.username?.message ??
                (availability === "checking"
                  ? "Checking…"
                  : availability === "taken"
                    ? "Taken."
                    : availability === "invalid"
                      ? "That username isn't allowed."
                      : availability === "available"
                        ? "Available."
                        : availability === "error"
                          ? "Couldn't check — try again."
                          : undefined)
              }
              className={
                availability === "available" && !errors.username
                  ? "text-ink-soft"
                  : undefined
              }
            />
          </div>

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

        <section className="space-y-5">
          <h2 className="font-display text-display-sm text-ink">
            Lenses
          </h2>
          <Controller
            control={control}
            name="signature_lenses"
            render={({ field }) => {
              const selected = new Set<Lens>(field.value ?? []);
              const atMax = selected.size >= MAX_SIGNATURE_LENSES;
              const toggle = (lens: Lens) => {
                const nextSet = new Set(selected);
                if (nextSet.has(lens)) nextSet.delete(lens);
                else if (nextSet.size < MAX_SIGNATURE_LENSES) nextSet.add(lens);
                field.onChange(Array.from(nextSet));
              };
              return (
                <>
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
                </>
              );
            }}
          />
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-display-sm text-ink">
            Privacy
          </h2>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-wine"
              {...register("is_private")}
            />
            <span>
              <span className="block font-body text-reading text-ink">
                Private profile
              </span>
              <span className="block font-mono text-meta-sm uppercase text-ink-muted">
                Only you can see your journals. Your handle stays visible.
              </span>
            </span>
          </label>
        </section>

        {formError && (
          <p
            role="alert"
            className="font-mono text-meta-sm uppercase text-wine"
          >
            {formError}
          </p>
        )}

        {saved && !formError && (
          <p className="font-mono text-meta-sm uppercase text-ink-soft">
            Saved.
          </p>
        )}

        <div className="border-t border-rule pt-6">
          <Button type="submit" size="lg" disabled={isPending || !isDirty}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

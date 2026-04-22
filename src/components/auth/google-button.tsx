"use client";

import { useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface GoogleButtonProps {
  next?: string;
  children?: ReactNode;
}

export function GoogleButton({ next, children }: GoogleButtonProps) {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    if (next) redirectTo.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });

    if (error) {
      setLoading(false);
    }
    // On success, Supabase redirects the browser; no local cleanup needed.
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      onClick={signInWithGoogle}
      disabled={loading}
      className="w-full"
    >
      {loading ? "Redirecting…" : (children ?? "Continue with Google")}
    </Button>
  );
}

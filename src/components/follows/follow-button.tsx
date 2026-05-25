"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  followAction,
  unfollowAction,
} from "@/app/(app)/[username]/follow-action";

interface FollowButtonProps {
  // The profile being followed/unfollowed.
  username: string;
  // The viewer's current relationship. Server-rendered, optimistically
  // updated client-side.
  initialFollowing: boolean;
  // When the viewer isn't signed in we route to /login with a `next` back
  // to the profile so the follow happens on return.
  isSignedIn: boolean;
  signInHref: string;
}

// Follow / Unfollow toggle. The label swap matters — "Following" with a
// hover state of "Unfollow" mirrors what every social product converged on,
// because it tells the viewer the current state without committing them to
// an action they didn't mean to take.
export function FollowButton({
  username,
  initialFollowing,
  isSignedIn,
  signInHref,
}: FollowButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [optimisticFollowing, setOptimisticFollowing] = useOptimistic<
    boolean,
    boolean
  >(initialFollowing, (_state, next) => next);

  function onToggle() {
    if (!isSignedIn) {
      router.push(signInHref);
      return;
    }
    setErrorMsg(null);

    const next = !optimisticFollowing;
    startTransition(async () => {
      setOptimisticFollowing(next);
      const result = next
        ? await followAction({ username })
        : await unfollowAction({ username });
      if (!result.ok) {
        setErrorMsg(result.error);
        // useOptimistic rolls back automatically when the transition unwinds
        // and the server-rendered value flows back through.
      }
    });
  }

  // Three-state label: not following → "Follow", following at rest →
  // "Following", following + hover/focus → "Unfollow". The group-hover
  // swap is the cleanest CSS path; aria-pressed conveys the state to AT.
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={optimisticFollowing ? "secondary" : "primary"}
        size="sm"
        onClick={onToggle}
        disabled={isPending}
        aria-pressed={optimisticFollowing}
        className="group min-w-[8rem]"
      >
        {optimisticFollowing ? (
          <>
            <span className="group-hover:hidden group-focus-visible:hidden">
              Following
            </span>
            <span className="hidden group-hover:inline group-focus-visible:inline">
              Unfollow
            </span>
          </>
        ) : (
          "Follow"
        )}
      </Button>
      {errorMsg && (
        <p
          role="alert"
          className="font-mono text-meta-sm uppercase text-wine"
        >
          {errorMsg}
        </p>
      )}
    </div>
  );
}

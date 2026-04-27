// Notification sentence renderer. Pure: takes the data the bell/popover
// already has on hand and returns structured segments + a click target.
// React renders the segments — actor segments are bold, film segments
// italic, plain segments un-styled.
//
// Centralizing here keeps the wording consistent everywhere notifications
// surface (popover, /notifications, future email digests).

import {
  REACTION_VERBS,
  isReactionType,
  type ReactionType,
} from "@/lib/social/reactions";

export type NotificationKind = "reaction" | "response" | "follow" | "mention";

// What the renderer needs. The query layer builds this shape from the raw
// notifications row + actor profile + perspective + film + (for reactions)
// the reaction's type + (for responses) whether it's nested.
export type EnrichedNotification = {
  id: string;
  type: NotificationKind;
  read_at: string | null;
  created_at: string;
  actor: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  perspective?: {
    id: string;
    film_title: string;
  };
  // For type='reaction'. The renderer falls back to "reacted to" if missing
  // (e.g. the reaction got deleted before we joined).
  reaction_type?: ReactionType;
  // For type='response'. True if this is a reply to a response (vs a
  // top-level response on the perspective).
  response_is_nested?: boolean;
  response_id?: string | null;
};

export type SentenceSegment =
  | { kind: "plain"; text: string }
  | { kind: "actor"; text: string }
  | { kind: "film"; text: string };

export type RenderedNotification = {
  segments: SentenceSegment[];
  href: string;
};

function actorName(actor: EnrichedNotification["actor"]): string {
  return actor.display_name?.trim() || `@${actor.username}`;
}

// Stable href to "the thing this notification is about". For responses we
// jump to the response anchor on the read view; the read-view component
// handles `#response-<id>` scrolling.
function notificationHref(n: EnrichedNotification): string {
  switch (n.type) {
    case "reaction":
      return n.perspective ? `/perspective/${n.perspective.id}` : "/notifications";
    case "response":
      return n.perspective
        ? `/perspective/${n.perspective.id}${n.response_id ? `#response-${n.response_id}` : ""}`
        : "/notifications";
    case "follow":
      return `/${n.actor.username}`;
    case "mention":
      return n.perspective ? `/perspective/${n.perspective.id}` : "/notifications";
  }
}

export function renderNotification(
  n: EnrichedNotification,
): RenderedNotification {
  const actor = actorName(n.actor);
  const href = notificationHref(n);

  switch (n.type) {
    case "reaction": {
      // "**Maya** was moved by your perspective on *Past Lives*"
      const verb =
        n.reaction_type && isReactionType(n.reaction_type)
          ? REACTION_VERBS[n.reaction_type]
          : "reacted to";
      const film = n.perspective?.film_title ?? "your perspective";
      return {
        href,
        segments: [
          { kind: "actor", text: actor },
          { kind: "plain", text: ` ${verb} your perspective on ` },
          { kind: "film", text: film },
        ],
      };
    }

    case "response": {
      // Top-level: "**Maya** responded to your perspective on *Past Lives*"
      // Nested:    "**Maya** replied to your response on *Past Lives*"
      const verb = n.response_is_nested
        ? "replied to your response on "
        : "responded to your perspective on ";
      const film = n.perspective?.film_title ?? "your perspective";
      return {
        href,
        segments: [
          { kind: "actor", text: actor },
          { kind: "plain", text: ` ${verb}` },
          { kind: "film", text: film },
        ],
      };
    }

    case "follow":
      // "**Maya** is now reading your perspectives"
      return {
        href,
        segments: [
          { kind: "actor", text: actor },
          { kind: "plain", text: " is now reading your perspectives" },
        ],
      };

    case "mention": {
      // Reserved for future (response @-mentions). Generic copy for now.
      const film = n.perspective?.film_title ?? "your perspective";
      return {
        href,
        segments: [
          { kind: "actor", text: actor },
          { kind: "plain", text: " mentioned you in " },
          { kind: "film", text: film },
        ],
      };
    }
  }
}

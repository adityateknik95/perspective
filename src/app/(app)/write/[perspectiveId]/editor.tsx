"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { EditorContent, useEditor, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Typography from "@tiptap/extension-typography";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import type { Lens } from "@/lib/lenses";
import {
  saveDraftAction,
  deletePerspectiveAction,
} from "./actions";
import { PublishDialog } from "./publish-dialog";

interface EditorProps {
  perspectiveId: string;
  initialTitle: string;
  initialSubtitle: string;
  initialBody: string;
  initialLenses: Lens[];
  initialIsPrivate: boolean;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

// Debounce window for autosave. 1.5s mirrors Medium/Substack — long enough
// that you don't round-trip on every keystroke, short enough that a surprise
// page close only loses a sentence.
const AUTOSAVE_DELAY_MS = 1500;

export function Editor({
  perspectiveId,
  initialTitle,
  initialSubtitle,
  initialBody,
  initialLenses,
  initialIsPrivate,
}: EditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Keep the latest form values in a ref so the debounced callback always
  // reads the freshest snapshot (closures vs. latest-state problem).
  const latestRef = useRef({ title, subtitle, body: initialBody });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We handle our own H2/H3 via the toolbar, plus StarterKit includes
        // paragraph/bold/italic/strike/blockquote/lists. Disable heading
        // levels 1, 4-6 — title is H1 outside the editor.
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      Underline,
      Typography,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          rel: "nofollow noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    content: initialBody || "",
    editorProps: {
      attributes: {
        class:
          "prose-like min-h-[50vh] font-body text-reading text-ink focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      latestRef.current.body = editor.getHTML();
      scheduleSave();
    },
  });

  // Fold title + subtitle changes into the same autosave cadence.
  useEffect(() => {
    latestRef.current.title = title;
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  useEffect(() => {
    latestRef.current.subtitle = subtitle;
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitle]);

  // Flush pending save on unmount / tab close.
  useEffect(() => {
    function onBeforeUnload() {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        // Fire-and-forget — we can't block navigation on a promise here.
        void runSave();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void runSave();
    }, AUTOSAVE_DELAY_MS);
    // scheduleSave and runSave are mutually recursive; capturing runSave as a
    // dep would force an identity-change loop. Resolving the reference at
    // call time (inside the timer) is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSave = useCallback(async () => {
    if (inFlightRef.current) {
      // A save is already in flight — reschedule so we don't lose edits
      // typed during the round-trip.
      scheduleSave();
      return;
    }
    inFlightRef.current = true;
    setStatus("saving");
    setErrorMsg(null);

    const snapshot = { ...latestRef.current };
    const result = await saveDraftAction(perspectiveId, {
      title: snapshot.title,
      subtitle: snapshot.subtitle || undefined,
      body: snapshot.body,
    });

    inFlightRef.current = false;
    if (result.ok) {
      setStatus("saved");
      setSavedAt(result.data?.savedAt ?? new Date().toISOString());
    } else {
      setStatus("error");
      setErrorMsg(result.error);
    }
  }, [perspectiveId, scheduleSave]);

  function onDelete() {
    if (!confirm("Delete this draft? This can't be undone.")) return;
    startTransition(async () => {
      await deletePerspectiveAction(perspectiveId);
    });
  }

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center justify-between gap-4 pb-6 font-mono text-meta-sm uppercase">
        <SaveIndicator status={status} savedAt={savedAt} errorMsg={errorMsg} />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onDelete}>
            Delete draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setPublishOpen(true)}
          >
            Publish…
          </Button>
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        maxLength={120}
        className="block w-full border-0 bg-transparent font-display text-display-lg leading-tight text-ink placeholder:text-ink-muted/50 focus:outline-none"
      />

      <input
        type="text"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        placeholder="Subtitle (optional)"
        maxLength={200}
        className="mt-3 block w-full border-0 bg-transparent font-body text-reading-lg italic text-ink-soft placeholder:text-ink-muted/50 focus:outline-none"
      />

      <div className="mt-8 border-t border-rule pt-8">
        {editor && <BubbleToolbar editor={editor} />}
        <EditorContent editor={editor} />
      </div>

      {publishOpen && editor && (
        <PublishDialog
          perspectiveId={perspectiveId}
          initialLenses={initialLenses}
          initialIsPrivate={initialIsPrivate}
          // Pass fresh snapshots from the ref so the publish payload reflects
          // whatever is on screen right now, not stale state.
          getSnapshot={() => ({
            title: latestRef.current.title,
            subtitle: latestRef.current.subtitle,
            body: editor.getHTML(),
          })}
          onClose={() => setPublishOpen(false)}
        />
      )}
    </div>
  );
}

function SaveIndicator({
  status,
  savedAt,
  errorMsg,
}: {
  status: SaveStatus;
  savedAt: string | null;
  errorMsg: string | null;
}) {
  if (status === "saving") {
    return <span className="text-ink-muted">Saving…</span>;
  }
  if (status === "error") {
    return (
      <span className="text-wine" title={errorMsg ?? undefined}>
        Save failed
      </span>
    );
  }
  if (status === "saved" && savedAt) {
    return (
      <span className="text-ink-muted">
        Saved <time dateTime={savedAt}>{formatSavedAt(savedAt)}</time>
      </span>
    );
  }
  return <span className="text-ink-muted">Draft</span>;
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// The floating toolbar that appears above a selection. Minimal by intent —
// every button here is something you'd use while typing prose, not doing
// layout.
function BubbleToolbar({ editor }: { editor: TiptapEditor }) {
  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, placement: "top" }}
      className="flex items-center gap-1 border border-ink bg-ink p-1 font-mono text-meta-sm uppercase text-cream shadow-sm"
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        label="B"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        label="I"
        className="italic"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        label="U"
        className="underline"
      />
      <Divider />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        label="H2"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        label="H3"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        label={"\u201C"}
      />
      <Divider />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label="UL"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label="OL"
      />
      <Divider />
      <ToolbarButton
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = prompt("Link URL", prev ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: url })
            .run();
        }}
        active={editor.isActive("link")}
        label="LINK"
      />
    </BubbleMenu>
  );
}

function ToolbarButton({
  onClick,
  active,
  label,
  className,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-[1.75rem] items-center justify-center px-2 transition-colors",
        active ? "bg-cream text-ink" : "text-cream hover:bg-ink-soft",
        className,
      )}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 inline-block h-4 w-px bg-ink-muted" />;
}

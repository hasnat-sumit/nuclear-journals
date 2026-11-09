"use client";

import { Bookmark, BookmarkCheck, Link2, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { api, errorMessage } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Comment, Paginated, RatingSummary } from "@/lib/types";

// Counted from the browser, so metadata rendering and crawlers of the HTML don't inflate it.
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    void api.post(`/articles/${slug}/view`).catch(() => undefined);
  }, [slug]);
  return null;
}

const ICON_BUTTON = "size-9 rounded-full";

export function ShareControls({ title }: { title: string }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  function shareTo(base: string) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(title);
    window.open(`${base}?url=${url}&text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <Button variant="outline" size="icon" className={ICON_BUTTON} onClick={copyLink} aria-label="Copy link" title="Copy link">
        <Link2 aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={`${ICON_BUTTON} text-xs font-semibold`}
        onClick={() => shareTo("https://x.com/intent/post")}
        aria-label="Share on X"
        title="Share on X"
      >
        X
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={`${ICON_BUTTON} text-xs font-semibold`}
        onClick={() => shareTo("https://www.linkedin.com/sharing/share-offsite/")}
        aria-label="Share on LinkedIn"
        title="Share on LinkedIn"
      >
        in
      </Button>
    </>
  );
}

export function BookmarkButton({ articleId }: { articleId: string }) {
  const { data: session } = authClient.useSession();
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!session) return;
    api
      .get<{ data: { bookmarked: boolean } }>(`/me/bookmarks/${articleId}`)
      .then(({ data }) => setBookmarked(data.bookmarked))
      .catch(() => undefined);
  }, [session, articleId]);

  if (!session) {
    return (
      <Link
        href="/sign-in"
        aria-label="Sign in to save this article"
        title="Sign in to save this article"
        className={cn(buttonVariants({ variant: "outline", size: "icon" }), ICON_BUTTON)}
      >
        <Bookmark aria-hidden="true" />
      </Link>
    );
  }

  async function toggle() {
    try {
      const { data } = bookmarked
        ? await api.delete<{ data: { bookmarked: boolean } }>(`/me/bookmarks/${articleId}`)
        : await api.put<{ data: { bookmarked: boolean } }>(`/me/bookmarks/${articleId}`);
      setBookmarked(data.bookmarked);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(ICON_BUTTON, bookmarked && "border-brand-teal text-brand-teal-strong")}
      onClick={toggle}
      aria-pressed={bookmarked}
      aria-label="Save article"
      title={bookmarked ? "Saved" : "Save article"}
    >
      {bookmarked ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
    </Button>
  );
}

export function RatingSummaryText({ summary }: { summary: RatingSummary }) {
  if (summary.count === 0) return <span className="text-muted-foreground">Not yet rated</span>;
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Star aria-hidden="true" className="size-4 fill-amber-400 text-amber-600" />
      <span className="font-medium text-foreground">{summary.average}</span>
      <span>
        ({summary.count} {summary.count === 1 ? "rating" : "ratings"})
      </span>
    </span>
  );
}

export function RatingControl({
  targetType,
  targetId,
  initial,
  label,
}: {
  targetType: "article" | "writer" | "reviewer";
  targetId: string;
  initial: RatingSummary;
  label: string;
}) {
  const { data: session } = authClient.useSession();
  const [summary, setSummary] = useState(initial);
  const [mine, setMine] = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;
    api
      .get<{ data: { score: number | null } }>(`/me/ratings/${targetType}/${targetId}`)
      .then(({ data }) => setMine(data.score))
      .catch(() => undefined);
  }, [session, targetType, targetId]);

  async function rate(score: number) {
    try {
      const { data } = await api.post<{ data: { score: number; summary: RatingSummary } }>("/ratings", {
        targetType,
        targetId,
        score,
      });
      setMine(data.score);
      setSummary(data.summary);
      toast.success("Thanks for your rating");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <RatingSummaryText summary={summary} />
      {session ? (
        <div role="group" aria-label={label} className="flex">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => rate(score)}
              aria-label={`Rate ${score} out of 5`}
              aria-pressed={mine === score}
              className="p-1 text-amber-600"
            >
              <Star aria-hidden="true" className={`size-5 ${mine !== null && score <= mine ? "fill-amber-400" : ""}`} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CommentsSection({ slug }: { slug: string }) {
  const { data: session } = authClient.useSession();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Paginated<Comment>>(`/articles/${slug}/comments?limit=50`)
      .then(({ data }) => setComments(data))
      .catch(() => setFailed(true));
  }, [slug]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(`/articles/${slug}/comments`, { content });
      setContent("");
      toast.success("Thanks. Your comment will appear after moderation.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="comments-heading" className="flex flex-col gap-5">
      <h2 id="comments-heading" className="text-2xl font-semibold">Comments</h2>
      {session ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Textarea
            aria-label="Your comment"
            placeholder="Add a thoughtful comment"
            value={content}
            maxLength={2000}
            required
            minLength={2}
            onChange={(event) => setContent(event.target.value)}
          />
          <div>
            <Button type="submit" disabled={saving}>{saving ? "Sending" : "Post comment"}</Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/sign-in" className="text-primary underline underline-offset-4">Sign in</Link> to join the discussion.
        </p>
      )}
      {failed ? <p role="alert" className="text-sm text-muted-foreground">Comments could not be loaded.</p> : null}
      {comments?.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : null}
      <ul className="flex flex-col gap-4">
        {comments?.map((comment) => (
          <li key={comment.id} className="border-t pt-4">
            <p className="text-sm font-medium text-foreground">
              {comment.author} <span className="font-normal text-muted-foreground">· {formatDate(comment.createdAt)}</span>
            </p>
            <p className="mt-1 leading-7 whitespace-pre-wrap">{comment.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

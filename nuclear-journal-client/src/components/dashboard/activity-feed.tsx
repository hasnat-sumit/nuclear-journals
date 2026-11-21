"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useApiQuery } from "@/hooks/use-api-query";
import { formatShortDate } from "@/lib/format";
import type { NotificationItem, Paginated } from "@/lib/types";

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

// Built from the person's own notifications, which the API already limits to
// what that role may know. For writers, that means official decisions only.
export function ActivityFeed({ limit = 5 }: { limit?: number }) {
  const { data, loading, error } = useApiQuery<Paginated<NotificationItem>>(`/me/notifications?limit=${limit}`);
  if (loading) return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  if (error) return <p className="text-sm text-muted-foreground">Activity could not be loaded.</p>;
  const items = data?.data ?? [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet. Updates about your work will appear here.</p>;

  return (
    <ol className="relative flex flex-col gap-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border">
      {items.map((item) => (
        <li key={item.id} className="relative flex gap-3">
          <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-brand-teal/40 bg-card text-brand-teal-strong">
            <Bell aria-hidden="true" className="size-3.5" />
          </span>
          <div className="flex flex-col gap-0.5 pt-1">
            {item.link ? (
              <Link href={item.link} className="text-sm leading-5 text-foreground hover:text-brand-teal-strong">{item.message}</Link>
            ) : (
              <p className="text-sm leading-5 text-foreground">{item.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatShortDate(item.createdAt)} · {timeFormatter.format(new Date(item.createdAt))}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

"use client";

import Link from "next/link";
import { PageTitle } from "@/components/dashboard/dashboard-shell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { NotificationItem, Paginated } from "@/lib/types";

export default function NotificationsPage() {
  const { data, error, loading, reload } = useApiQuery<Paginated<NotificationItem> & { unread: number }>("/me/notifications?limit=50");

  async function markAllRead() {
    await api.post("/me/notifications/read-all").catch(() => undefined);
    reload();
  }

  return (
    <>
      <PageTitle
        title="Notifications"
        action={data && data.unread > 0 ? <Button variant="outline" onClick={markAllRead}>Mark all as read</Button> : undefined}
      />
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data?.data.length === 0 ? <EmptyState title="You're all caught up" /> : null}
      <ul className="flex flex-col gap-2">
        {data?.data.map((item) => (
          <li key={item.id} className={`rounded-lg border bg-card p-4 ${item.read ? "" : "border-l-4 border-l-brand-teal"}`}>
            {item.link ? <Link href={item.link} className="hover:underline">{item.message}</Link> : <p>{item.message}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(item.createdAt)}
              {item.read ? "" : " · Unread"}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

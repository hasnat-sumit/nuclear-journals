"use client";

import Link from "next/link";
import { PageTitle } from "@/components/dashboard/dashboard-shell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { ArticleGrid } from "@/components/site/article-cards";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import type { ArticleSummary, Paginated } from "@/lib/types";

export default function BookmarksPage() {
  const { data, error, loading, reload } = useApiQuery<Paginated<ArticleSummary>>("/me/bookmarks?limit=50");
  return (
    <>
      <PageTitle title="Bookmarks" />
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data?.data.length === 0 ? (
        <EmptyState title="No saved articles" action={<Link href="/articles" className={buttonVariants()}>Browse articles</Link>} />
      ) : null}
      {data && data.data.length > 0 ? <ArticleGrid articles={data.data} /> : null}
    </>
  );
}

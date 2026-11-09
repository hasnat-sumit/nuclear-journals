import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArticleGridSkeleton, EmptyState } from "@/components/feedback-states";
import { ArticleGrid } from "@/components/site/article-cards";
import { Pagination } from "@/components/site/pagination";
import { getPublicData, getPublicList } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ArticleSummary, Category } from "@/lib/types";

export const metadata: Metadata = {
  title: "Articles",
  description: "Browse and search articles on nuclear science, engineering, energy and safety.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined) {
  return typeof value === "string" && value ? value : undefined;
}

function Filters({ params, categories }: { params: Record<string, string | undefined>; categories: Category[] }) {
  const hrefWith = (change: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, page: undefined, ...change })) {
      if (value) query.set(key, value);
    }
    const text = query.toString();
    return text ? `/articles?${text}` : "/articles";
  };
  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-sm transition-colors hover:border-brand-teal",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
    );

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
        <Link href={hrefWith({ category: undefined })} className={pill(!params.category)}>All</Link>
        {categories.map((category) => (
          <Link key={category.id} href={hrefWith({ category: category.slug })} className={pill(params.category === category.slug)}>
            {category.name}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {params.q ? (
          <nav aria-label="Sort results" className="flex gap-2">
            <Link href={hrefWith({ sort: "relevant" })} className={pill(params.sort !== "latest")}>Most relevant</Link>
            <Link href={hrefWith({ sort: "latest" })} className={pill(params.sort === "latest")}>Latest</Link>
          </nav>
        ) : null}
        {params.tag ? (
          <p className="text-muted-foreground">
            Tag: <strong className="text-foreground">{params.tag}</strong>{" "}
            <Link href={hrefWith({ tag: undefined })} className="text-primary underline underline-offset-4">Clear</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const params = {
    q: single(raw.q)?.slice(0, 200),
    category: single(raw.category),
    tag: single(raw.tag),
    sort: single(raw.sort) === "latest" ? "latest" : undefined,
    page: /^\d+$/.test(single(raw.page) ?? "") ? single(raw.page) : undefined,
  };

  const query = new URLSearchParams({ limit: "12" });
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.tag) query.set("tag", params.tag);
  if (params.page) query.set("page", params.page);
  query.set("sort", params.q && params.sort !== "latest" ? "relevant" : "latest");

  const [results, categories] = await Promise.all([
    getPublicList<ArticleSummary>(`/articles?${query.toString()}`),
    getPublicData<Category[]>("/categories"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {params.q ? (
        <p aria-live="polite" className="text-muted-foreground">
          {results.pagination.total} {results.pagination.total === 1 ? "result" : "results"} for{" "}
          <strong className="text-foreground">{params.q}</strong>
        </p>
      ) : null}
      <Filters params={params} categories={categories ?? []} />
      {results.data.length > 0 ? (
        <ArticleGrid articles={results.data} />
      ) : (
        <EmptyState title="No articles found" description="Try a different search term or category." />
      )}
      <Pagination pagination={results.pagination} basePath="/articles" params={{ ...params, page: undefined }} />
    </div>
  );
}

export default function ArticlesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6">
      <h1 className="text-4xl font-semibold">Articles</h1>
      <Suspense fallback={<ArticleGridSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

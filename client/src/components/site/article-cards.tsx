import { CalendarDays, ChevronRight, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ArticleArt } from "@/components/site/artwork";
import { CategoryIcon } from "@/lib/category-icons";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ArticleSummary, Category } from "@/lib/types";

export function ArticleImage({
  article,
  className,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority,
}: {
  article: Pick<ArticleSummary, "slug" | "coverImage">;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted", className)}>
      {article.coverImage ? (
        <Image src={article.coverImage.url} alt={article.coverImage.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <ArticleArt seed={article.slug} />
      )}
    </div>
  );
}

export function CategoryPill({ category, className }: { category: { name: string; slug: string }; className?: string }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        "relative z-10 inline-flex w-fit items-center rounded-full bg-brand-teal-strong px-2.5 py-0.5 text-xs font-medium text-white hover:bg-primary",
        className,
      )}
    >
      {category.name}
    </Link>
  );
}

export function ArticleMeta({ article, showAuthor = true, className }: { article: ArticleSummary; showAuthor?: boolean; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {showAuthor && article.author ? <span className="font-medium text-foreground">By {article.author.name}</span> : null}
      {article.publishedAt ? (
        <span className="inline-flex items-center gap-1">
          <CalendarDays aria-hidden="true" className="size-3.5" />
          <time dateTime={article.publishedAt}>{formatShortDate(article.publishedAt)}</time>
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1">
        <Clock aria-hidden="true" className="size-3.5" />
        {article.readingTime} min read
      </span>
    </p>
  );
}

// The whole card is clickable through a stretched link; the category pill sits above it.
export function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <ArticleImage article={article} className="aspect-16/10 rounded-none" />
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        {article.category ? <CategoryPill category={article.category} /> : null}
        <h3 className="text-lg leading-snug font-semibold">
          <Link href={`/articles/${article.slug}`} className="after:absolute after:inset-0 group-hover:text-brand-teal-strong">
            {article.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{article.excerpt}</p>
        <ArticleMeta article={article} className="mt-auto pt-2" />
      </div>
    </article>
  );
}

export function ArticleGrid({ articles }: { articles: ArticleSummary[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}

export function FeaturedArticle({ article }: { article: ArticleSummary }) {
  return (
    <article className="group relative flex flex-col gap-4">
      <ArticleImage article={article} className="aspect-16/10 rounded-xl" sizes="(min-width: 1024px) 40vw, 100vw" priority />
      <div className="flex flex-col gap-2.5">
        <h3 className="text-2xl leading-tight font-semibold">
          <Link href={`/articles/${article.slug}`} className="after:absolute after:inset-0 group-hover:text-brand-teal-strong">
            {article.title}
          </Link>
        </h3>
        <p className="line-clamp-2 leading-7 text-muted-foreground">{article.excerpt}</p>
        <ArticleMeta article={article} />
        {article.category ? <CategoryPill category={article.category} /> : null}
      </div>
    </article>
  );
}

export function CompactArticle({ article }: { article: ArticleSummary }) {
  return (
    <article className="group relative flex items-start gap-4">
      <ArticleImage article={article} className="aspect-4/3 w-24 shrink-0 sm:w-28" sizes="112px" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="font-heading text-base leading-snug font-semibold">
          <Link href={`/articles/${article.slug}`} className="after:absolute after:inset-0 group-hover:text-brand-teal-strong">
            {article.title}
          </Link>
        </h3>
        <ArticleMeta article={article} showAuthor={false} />
      </div>
    </article>
  );
}

export function CategoryList({ categories }: { categories: Category[] }) {
  return (
    <ul className="flex flex-col">
      {categories.map((category) => {
        return (
          <li key={category.id} className="border-b last:border-b-0">
            <Link
              href={`/categories/${category.slug}`}
              className="group flex items-center gap-3 py-2.5 text-sm text-foreground hover:text-brand-teal-strong"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-teal/10 text-brand-teal-strong">
                <CategoryIcon slug={category.slug} className="size-4" />
              </span>
              <span className="flex-1">{category.name}</span>
              <span className="text-xs text-muted-foreground">{category.articleCount}</span>
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground group-hover:text-brand-teal-strong" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="flex items-start gap-4 rounded-xl border bg-card p-5 transition-all hover:border-brand-teal hover:shadow-sm"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal-strong">
        <CategoryIcon slug={category.slug} className="size-5" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-heading font-semibold text-primary">{category.name}</span>
        <span className="line-clamp-2 text-sm text-muted-foreground">{category.description}</span>
        <span className="mt-1 text-xs text-muted-foreground">
          {category.articleCount} {category.articleCount === 1 ? "article" : "articles"}
        </span>
      </span>
    </Link>
  );
}

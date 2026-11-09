import { CalendarDays, ChevronRight, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/feedback-states";
import { ArticleImage, CategoryPill, CompactArticle } from "@/components/site/article-cards";
import { BookmarkButton, CommentsSection, RatingControl, ShareControls, ViewTracker } from "@/components/site/article-actions";
import { AuthorProfile, Avatar } from "@/components/site/author-profile";
import { getPublicData } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { withTableOfContents } from "@/lib/toc";
import type { ArticleDetail } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

const getArticle = (slug: string) => getPublicData<ArticleDetail>(`/articles/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      publishedTime: article.publishedAt ?? undefined,
      authors: article.author ? [article.author.name] : undefined,
      images: article.coverImage ? [{ url: article.coverImage.url, alt: article.coverImage.alt }] : undefined,
    },
  };
}

function Byline({ article }: { article: ArticleDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      {article.author ? (
        <div className="flex items-center gap-3">
          <Avatar name={article.author.name} image={article.author.image} size="sm" className="size-10 text-sm" />
          <div className="text-sm leading-5">
            <p>
              By{" "}
              <Link href={`/authors/${article.author.id}`} className="font-semibold text-foreground hover:text-brand-teal-strong">
                {article.author.name}
              </Link>
            </p>
            <p className="text-muted-foreground">Writer</p>
          </div>
        </div>
      ) : null}
      {/* Reviewers appear only when they opted in to public recognition. */}
      {article.reviewers.length > 0 ? (
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {article.reviewers.slice(0, 3).map((reviewer) => (
              <Avatar key={reviewer.id} name={reviewer.name} image={null} size="sm" className="size-10 bg-brand-teal-strong text-sm ring-2 ring-background" />
            ))}
          </div>
          <div className="text-sm leading-5">
            <p>
              Reviewed by{" "}
              {article.reviewers.map((reviewer, index) => (
                <span key={reviewer.id}>
                  {index > 0 ? ", " : ""}
                  <Link href={`/reviewers/${reviewer.id}`} className="font-semibold text-foreground hover:text-brand-teal-strong">
                    {reviewer.name}
                  </Link>
                </span>
              ))}
            </p>
            <p className="text-muted-foreground">Reviewer</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function ArticleContent({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const { html, toc } = withTableOfContents(article.contentHtml);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    author: article.author ? { "@type": "Person", name: article.author.name } : undefined,
    image: article.coverImage?.url,
  };

  return (
    <article className="flex flex-col gap-10">
      <ViewTracker slug={article.slug} />
      <script
        type="application/ld+json"
        // Escaping "<" stops article text from closing this script tag early.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />

      <header className="flex max-w-3xl flex-col gap-5">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-primary">Home</Link></li>
            <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
            <li><Link href="/articles" className="hover:text-primary">Articles</Link></li>
            {article.category ? (
              <>
                <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
                <li><Link href={`/categories/${article.category.slug}`} className="hover:text-primary">{article.category.name}</Link></li>
              </>
            ) : null}
          </ol>
        </nav>
        {article.category ? <CategoryPill category={article.category} /> : null}
        <h1 className="text-4xl leading-tight font-bold sm:text-5xl">{article.title}</h1>
        <p className="text-lg leading-8 text-muted-foreground sm:text-xl">{article.excerpt}</p>
        <Byline article={article} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
          <p className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              <time dateTime={article.publishedAt ?? undefined}>{formatDate(article.publishedAt)}</time>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden="true" className="size-4" />
              {article.readingTime} min read
            </span>
          </p>
          <div className="flex items-center gap-2">
            <BookmarkButton articleId={article.id} />
            <ShareControls title={article.title} />
          </div>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-10">
          <ArticleImage article={article} className="aspect-16/9 rounded-xl" sizes="(min-width: 1024px) 800px, 100vw" priority />

          {/* Sanitized by an allowlist on the server before it is ever stored. */}
          <div className="article-body max-w-3xl" dangerouslySetInnerHTML={{ __html: html }} />

          {article.tags.length > 0 ? (
            <ul aria-label="Tags" className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <li key={tag}>
                  <Link href={`/articles?tag=${encodeURIComponent(tag)}`} className="rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground hover:border-brand-teal">
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {article.references.length > 0 ? (
            <section aria-labelledby="references-heading" className="flex flex-col gap-3 border-t pt-6">
              <h2 id="references-heading" className="text-2xl font-semibold">References</h2>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-6">
                {article.references.map((reference, index) => (
                  <li key={index}>
                    {reference.citation}{" "}
                    {reference.url ? (
                      <a href={reference.url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-teal-strong underline underline-offset-2">
                        Source
                      </a>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section aria-label="Rate this article" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
            <p className="font-heading font-semibold text-primary">Was this article useful?</p>
            <RatingControl targetType="article" targetId={article.id} initial={article.rating} label="Rate this article" />
          </section>

          {article.author ? <AuthorProfile author={article.author} /> : null}

          <CommentsSection slug={article.slug} />
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:h-fit">
          {toc.length > 0 ? (
            <nav aria-labelledby="toc-heading" className="rounded-xl border bg-card p-5">
              <h2 id="toc-heading" className="text-base font-semibold">Table of contents</h2>
              <ol className="mt-3 flex flex-col gap-2 text-sm">
                {toc.map((entry, index) => (
                  <li key={entry.id} className="flex gap-2">
                    <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
                    <a href={`#${entry.id}`} className="text-foreground hover:text-brand-teal-strong">{entry.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          {article.related.length > 0 ? (
            <section aria-labelledby="related-heading" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
              <h2 id="related-heading" className="text-base font-semibold">Related articles</h2>
              {article.related.slice(0, 4).map((related) => (
                <CompactArticle key={related.id} article={related} />
              ))}
            </section>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

export default function ArticlePage({ params }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="max-w-3xl"><LoadingSkeleton rows={6} /></div>}>
        <ArticleContent params={params} />
      </Suspense>
    </div>
  );
}

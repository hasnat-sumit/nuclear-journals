import { Mail } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { HomeArticleSections } from "@/components/site/home-article-sections";
import { Banner } from "@/components/site/banner";
import { LoadingSkeleton } from "@/components/feedback-states";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <>
      <Banner />
      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 pt-12 sm:px-6 md:gap-20 md:pt-16">
        <Suspense fallback={<LoadingSkeleton rows={5} />}>
          <HomeArticleSections />
        </Suspense>

        <section className="flex flex-col gap-6 rounded-xl border bg-card p-6 md:flex-row md:items-center md:p-8">
          <Mail aria-hidden="true" strokeWidth={1.5} className="size-12 shrink-0 text-primary" />
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Stay updated</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Create a free account to save articles, join the discussion and apply to write or review.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }), "px-5")}>Create an account</Link>
            <Link href="/reviewer-guidelines" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-5")}>
              Become a reviewer
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

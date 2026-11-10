import { ArrowRight, BookOpen, Layers, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { getPublicData } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SiteStats {
  publishedArticles: number;
  activeResearchers: number;
  researchAreas: number;
}

// Three equal columns on phones; on wider screens it hugs its content like the mockup.
const STATS_BAR =
  "grid w-full grid-cols-3 divide-x rounded-xl border bg-background/90 py-3 shadow-sm backdrop-blur sm:flex sm:w-auto sm:self-start";
const STAT = "flex min-w-0 flex-col items-center gap-1.5 px-2 text-center sm:flex-row sm:gap-3 sm:px-6 sm:text-left";

export function Banner() {
  return (
    <section className="relative isolate overflow-hidden bg-background">
      <Image
        src="/hero-nuclear-plant.jpg"
        alt="Cooling towers of a nuclear power plant beside a lake under a clear sky"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[72%_center] md:object-center"
      />
      {/* The photo's left side is open sky, so a light fade is enough to keep the text readable. */}
      <div className="absolute inset-0 -z-10 bg-background/75 md:bg-transparent md:bg-linear-to-r md:from-background/85 md:from-15% md:via-background/40 md:via-45% md:to-background/0" />

      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pt-16 pb-8 sm:px-6 md:pt-24 md:pb-10">
        <div className="flex max-w-2xl flex-col items-start gap-5">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.18em] text-brand-teal uppercase sm:text-sm">
            Nuclear Science &amp; Technology
            <span aria-hidden="true" className="h-px w-10 bg-brand-teal" />
          </p>
          <h1 className="font-heading text-4xl leading-[1.1] font-bold text-primary sm:text-5xl lg:text-6xl">
            Advancing Knowledge in Nuclear Science.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-foreground/80">
            Discover cutting-edge research, engineering innovation and the future of nuclear technology.
          </p>
          <Link
            href="/articles"
            className={cn(buttonVariants({ size: "lg" }), "mt-1 h-11 gap-2 rounded-md bg-brand-teal px-5 text-white hover:bg-brand-teal-strong")}
          >
            Explore Research <ArrowRight aria-hidden="true" />
          </Link>
        </div>

        <Suspense fallback={<StatsSkeleton />}>
          <HeroStats />
        </Suspense>
      </div>
    </section>
  );
}

async function HeroStats() {
  // The hero is decoration around the articles, so a stats failure shows nothing rather than an error page.
  const stats = await getPublicData<SiteStats>("/stats").catch(() => null);
  if (!stats) return null;
  const format = (value: number) => value.toLocaleString("en-US");

  return (
    <dl className={STATS_BAR}>
      <Stat icon={<BookOpen />} value={format(stats.publishedArticles)} label="Published Articles" />
      <Stat icon={<Users />} value={format(stats.activeResearchers)} label="Active Researchers" />
      <Stat icon={<Layers />} value={format(stats.researchAreas)} label="Research Areas" />
    </dl>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className={STAT}>
      <span aria-hidden="true" className="text-primary [&_svg]:size-5 [&_svg]:stroke-[1.5] sm:[&_svg]:size-6">{icon}</span>
      {/* Label first for screen readers; shown below the number. */}
      <div className="flex flex-col-reverse">
        <dt className="text-[11px] leading-tight text-muted-foreground sm:text-xs">{label}</dt>
        <dd className="font-heading text-lg leading-tight font-bold text-primary sm:text-xl">{value}</dd>
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div aria-hidden="true" className={STATS_BAR}>
      {[0, 1, 2].map((key) => (
        <div key={key} className={STAT}>
          <span className="size-6 animate-pulse rounded bg-muted" />
          <span className="flex flex-col items-center gap-1.5 sm:items-start">
            <span className="h-5 w-12 animate-pulse rounded bg-muted" />
            <span className="h-3 w-24 animate-pulse rounded bg-muted" />
          </span>
        </div>
      ))}
    </div>
  );
}

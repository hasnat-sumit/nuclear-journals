import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Banner() {
  return (
    <section className="relative isolate overflow-hidden bg-primary">
      <Image
        src="/nuclear-power-plant-kalinin.jpg"
        alt="Cooling towers at the Kalinin Nuclear Power Plant in Russia"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-primary from-10% via-primary/85 to-primary/15 md:via-primary/70" />
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 pt-20 pb-28 sm:px-6 md:pt-28 md:pb-36">
        <p className="text-sm font-medium tracking-[0.2em] text-[#8fbdb9] uppercase">Share | Review | Learn</p>
        <h1 className="max-w-2xl text-5xl leading-[1.05] font-bold text-white sm:text-6xl">Nuclear Journal</h1>
        <p className="max-w-xl text-lg leading-8 text-white/85">
          Explore insightful articles, expert perspectives, and the latest developments in nuclear science, engineering, energy and safety.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/articles" className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 rounded-full bg-white px-6 text-primary hover:bg-white/90")}>
            Browse articles <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/contributor-guidelines" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-11 rounded-full px-6 text-white hover:bg-white/10 hover:text-white")}>
            Write for us
          </Link>
        </div>
      </div>
      <p className="absolute right-4 bottom-3 max-w-[calc(100%-2rem)] text-right text-xs text-white/80 sm:right-6">
        Photo: Vsatinet, <Link href="https://commons.wikimedia.org/wiki/File:Cooling_towers_of_a_nuclear_power_plant.jpg" className="underline underline-offset-2">Wikimedia Commons</Link>, cropped, <Link href="https://creativecommons.org/licenses/by-sa/4.0/" className="underline underline-offset-2">CC BY-SA 4.0</Link>.
      </p>
    </section>
  );
}

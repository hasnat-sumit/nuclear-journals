import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <Link href="/" aria-label="Nuclear Journal home" className={cn("flex shrink-0 items-center", className)}>
      {/* The dark logo disappears on navy, so dark backgrounds get the light neon version. */}
      <Image
        src={inverted ? "/nuclear-journal-neon-logo.png" : "/nuclear-journal-logo.png"}
        alt="Nuclear Journal"
        width={1536}
        height={1024}
        sizes="150px"
        preload={!inverted}
        className={cn("h-16 w-30 object-cover object-center", inverted && "mix-blend-screen")}
      />
    </Link>
  );
}

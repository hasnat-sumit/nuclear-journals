import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <Link href="/" aria-label="Nuclear Journal home" className={cn("flex shrink-0 items-center", className)}>
      <Image
        src="/nuclear-journal-logo.png"
        alt="Nuclear Journal"
        width={1400}
        height={1000}
        sizes="150px"
        preload={!inverted}
        className="h-16 w-30 object-cover object-center"
      />
    </Link>
  );
}

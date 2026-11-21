"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/articles", label: "Articles" },
  { href: "/categories", label: "Categories" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// The current URL is only known at request time, so the links first render
// without a highlight and the active one lights up as the page streams in.
export function NavLinks({ className }: { className?: string }) {
  return (
    <Suspense fallback={<LinkList className={className} pathname={null} />}>
      <ActiveNavLinks className={className} />
    </Suspense>
  );
}

function ActiveNavLinks({ className }: { className?: string }) {
  return <LinkList className={className} pathname={usePathname()} />;
}

function LinkList({ className, pathname }: { className?: string; pathname: string | null }) {
  return (
    // Tighter and evenly spread on phones, so all five links fit without scrolling.
    <ul className={cn("flex items-center justify-between gap-4 text-sm sm:justify-start sm:gap-6", className)}>
      {LINKS.map((link) => {
        const active = pathname !== null && isActive(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-block py-1 whitespace-nowrap text-muted-foreground transition-colors hover:text-primary",
                active && "font-medium text-primary after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-brand-teal",
              )}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

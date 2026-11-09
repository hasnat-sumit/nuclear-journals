import { Search } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/site/brand";
import { NavLinks } from "@/components/site/nav-links";
import { SearchBar } from "@/components/site/search-bar";
import { UserMenu } from "@/components/site/user-menu";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
      <nav aria-label="Main" className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:gap-x-8">
        <Logo />
        <NavLinks className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-1 lg:order-0 lg:mx-0 lg:w-auto lg:overflow-visible lg:p-0" />
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <SearchBar className="hidden md:block" />
          <Link href="/articles" aria-label="Search articles" className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary md:hidden">
            <Search aria-hidden="true" className="size-5" />
          </Link>
          <UserMenu />
        </div>
      </nav>
    </header>
  );
}

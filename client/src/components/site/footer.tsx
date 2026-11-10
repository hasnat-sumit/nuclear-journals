import Image from "next/image";
import Link from "next/link";

const FOOTER_GROUPS = [
  {
    title: "Read",
    links: [
      { href: "/articles", label: "All articles" },
      { href: "/categories", label: "Categories" },
      { href: "/about", label: "About" },
    ],
  },
  {
    title: "Contribute",
    links: [
      { href: "/contributor-guidelines", label: "Contributor guidelines" },
      { href: "/how-to-publish", label: "How to Publish" },
      { href: "/reviewer-guidelines", label: "Reviewer guidelines" },
      { href: "/sign-up", label: "Create an account" },
    ],
  },
  {
    title: "Journal",
    links: [
      { href: "/editorial-policy", label: "Editorial policy" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-20 bg-primary text-primary-foreground">
      {/* The logo gets its own row until there is room for four columns, so it is never cropped. */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 pt-6 pb-10 sm:grid-cols-3 sm:px-6 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:gap-10">
        <div className="col-span-2 flex flex-col items-start sm:col-span-3 lg:col-span-1">
          <Link href="/" aria-label="Nuclear Journal home" className="block h-28 w-56 overflow-hidden sm:h-36 sm:w-[300px]">
            <Image
              src="/nuclear-journal-neon-logo.png"
              alt="Nuclear Journal"
              width={1536}
              height={1024}
              sizes="300px"
              className="h-full w-full object-cover mix-blend-screen"
            />
          </Link>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <p className="text-xs font-semibold tracking-wider text-primary-foreground/60 uppercase">{group.title}</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-primary-foreground/85 underline-offset-4 hover:text-white hover:underline">{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-primary-foreground/60 sm:flex-row sm:px-6">
          <p> Nuclear Journal is an editorial publication, not a formal academic peer-reviewed journal.</p>
          <p>
            Developed by{" "}
            <Link href="https://kamrulhsumit.vercel.app/" className="text-primary-foreground/85 underline-offset-4 hover:text-white hover:underline">
              Kamrul H. Sumit
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

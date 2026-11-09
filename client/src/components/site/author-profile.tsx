import Image from "next/image";
import Link from "next/link";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "size-8 text-xs", px: 32 },
  md: { box: "size-14 text-lg", px: 56 },
  lg: { box: "size-28 text-3xl border-4 border-card", px: 112 },
};

export function Avatar({
  name,
  image,
  size = "md",
  className,
}: {
  name: string;
  image: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { box, px } = SIZES[size];
  if (image) {
    return <Image src={image} alt="" width={px} height={px} className={cn("shrink-0 rounded-full object-cover", box, className)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-heading font-semibold text-primary-foreground",
        box,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AuthorProfile({
  author,
}: {
  author: { id: string; name: string; image: string | null; bio: string | null };
}) {
  return (
    <aside aria-label="About the author" className="flex items-start gap-4 rounded-xl border bg-card p-5">
      <Avatar name={author.name} image={author.image} />
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Written by</p>
        <Link href={`/authors/${author.id}`} className="font-heading text-lg font-semibold text-primary hover:text-brand-teal">
          {author.name}
        </Link>
        {author.bio ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{author.bio}</p> : null}
      </div>
    </aside>
  );
}

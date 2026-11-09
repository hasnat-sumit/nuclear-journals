const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : "";
}

export function formatShortDate(value: string | null | undefined) {
  return value ? shortDateFormatter.format(new Date(value)) : "";
}

export function humanize(value: string) {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "Dr. Ahmed Rahman" becomes "AR". Titles are skipped so initials stay meaningful.
export function initials(name: string) {
  const words = name
    .split(/\s+/)
    .filter((word) => word && !/^(dr|prof|mr|mrs|ms|engr)\.?$/i.test(word));
  const letters = words.length > 1 ? [words[0]![0], words.at(-1)![0]] : [words[0]?.[0]];
  return letters.join("").toUpperCase() || "?";
}

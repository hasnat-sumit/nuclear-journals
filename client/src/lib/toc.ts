// Builds the article's table of contents from its <h2> headings and gives
// each one an id to link to. The server sanitizer strips every attribute from
// headings, so the only id on them is the one added here, made of [a-z0-9-].

export interface TocEntry {
  id: string;
  text: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

function toText(html: string) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function withTableOfContents(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const used = new Set<string>();
  const output = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_match, inner: string) => {
    const text = toText(inner);
    const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "section";
    let id = base;
    for (let suffix = 2; used.has(id); suffix += 1) id = `${base}-${suffix}`;
    used.add(id);
    if (text) toc.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: output, toc };
}

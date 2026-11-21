import sanitizeHtml from "sanitize-html";

const WORDS_PER_MINUTE = 200;

// Allowlist: anything not named here, including scripts and event handlers, is removed.
const options: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "pre", "code", "strong", "em",
    "s", "u", "a", "img", "hr", "br", "sub", "sup",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  exclusiveFilter: (frame) =>
    frame.tag === "img" && !isCloudinaryUrl(frame.attribs.src ?? ""),
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
  },
};

export function isCloudinaryUrl(value: string) {
  return URL.canParse(value) && new URL(value).hostname === "res.cloudinary.com";
}

export function sanitizeArticleHtml(html: string) {
  return sanitizeHtml(html, options);
}

export function toPlainText(html: string) {
  return sanitizeHtml(html.replace(/<\/(p|h\d|li|blockquote|pre)>/g, "$& "), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text: string) {
  return text ? text.split(" ").length : 0;
}

export function readingTimeMinutes(text: string) {
  return Math.max(1, Math.ceil(countWords(text) / WORDS_PER_MINUTE));
}

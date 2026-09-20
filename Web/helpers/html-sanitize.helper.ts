import sanitizeHtml from "sanitize-html";

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "div", "span", "blockquote", "pre", "code",
    "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
    "ul", "ol", "li", "dl", "dt", "dd",
    "a", "img", "figure", "figcaption", "picture", "source", "video", "audio", "iframe",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  ],
  allowedAttributes: {
    "*": ["class", "style", "id", "title", "dir", "lang", "align"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "srcset", "alt", "width", "height", "loading"],
    source: ["src", "srcset", "type", "media"],
    video: ["src", "controls", "width", "height", "poster", "preload"],
    audio: ["src", "controls", "preload"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
  allowedStyles: {
    "*": {
      color: [/^[#\w(),.%\s-]+$/],
      "background-color": [/^[#\w(),.%\s-]+$/],
      "text-align": [/^(left|right|center|justify)$/],
      "font-size": [/^[\d.]+(px|em|rem|%|pt)$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/],
      "font-style": [/^(normal|italic)$/],
      "text-decoration": [/^[\w\s-]+$/],
      "line-height": [/^[\d.]+(px|em|rem|%)?$/],
      width: [/^[\d.]+(px|em|rem|%)$/],
      height: [/^[\d.]+(px|em|rem|%)$/],
      "max-width": [/^[\d.]+(px|em|rem|%)$/],
      margin: [/^[\d.\s\w%-]+$/],
      padding: [/^[\d.\s\w%-]+$/],
      "text-indent": [/^[\d.]+(px|em|rem|%)$/],
      "vertical-align": [/^[\w-]+$/],
      "list-style-type": [/^[\w-]+$/],
    },
  },
  transformTags: {
    a: (tagName, attribs) => {
      const next = { ...attribs };
      if (next.target === "_blank") next.rel = "noopener noreferrer";
      return { tagName, attribs: next };
    },
  },
};

const memo = new Map<string, string>();
const MEMO_LIMIT = 500;

export const safeHtml = (html: unknown): string => {
  if (typeof html !== "string" || html === "") return "";
  const cached = memo.get(html);
  if (cached !== undefined) return cached;

  const clean = sanitizeHtml(html, RICH_TEXT_OPTIONS);
  if (memo.size >= MEMO_LIMIT) memo.delete(memo.keys().next().value as string);
  memo.set(html, clean);
  return clean;
};

export const safeJson = (value: unknown): string =>
  (JSON.stringify(value) ?? "null")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export const safeUrl = (url: unknown): string => {
  if (typeof url !== "string") return "#";
  const value = url.trim();
  if (/^(\/(?!\/)|#|\?)/.test(value)) return value;
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  return "#";
};

export const safeColor = (color: unknown): string => {
  if (typeof color !== "string") return "transparent";
  const value = color.trim();
  return /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|(rgb|hsl)a?\([\d\s.,%/-]{1,40}\))$/.test(value) ? value : "transparent";
};

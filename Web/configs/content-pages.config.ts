// Storefront pages whose text the store can rewrite in Settings > Page Content.
// A page with no saved text shows the default copy in its own Pug view.
export const CONTENT_PAGES = [
  { key: "about", title: "About Us", view: "client/pages/about" },
  { key: "faq", title: "FAQ", view: "client/pages/faq" },
  { key: "privacyPolicy", title: "Privacy Policy", view: "client/pages/privacy-policy" },
  { key: "termsAndConditions", title: "Terms & Conditions", view: "client/pages/terms-and-conditions" },
  { key: "returnPolicy", title: "Return Policy", view: "client/pages/return-policy" },
] as const;

export type ContentPageKey = (typeof CONTENT_PAGES)[number]["key"];

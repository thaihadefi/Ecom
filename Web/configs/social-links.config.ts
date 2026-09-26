// Social profiles a store can link from the footer (Settings > General). Add a network here.
export const SOCIAL_LINKS = [
  { key: "facebookUrl", label: "Facebook", icon: "fab fa-facebook-f" },
  { key: "instagramUrl", label: "Instagram", icon: "fab fa-instagram" },
  { key: "youtubeUrl", label: "YouTube", icon: "fab fa-youtube" },
  { key: "tiktokUrl", label: "TikTok", icon: "fab fa-tiktok" },
  { key: "linkedinUrl", label: "LinkedIn", icon: "fab fa-linkedin-in" },
  { key: "xUrl", label: "X", icon: "fab fa-x-twitter" },
] as const;

export type SocialLinkKey = (typeof SOCIAL_LINKS)[number]["key"];

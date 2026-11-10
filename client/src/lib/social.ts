import type { Role, SocialPlatform } from "./types";

// Must match SOCIAL_PLATFORMS on the server.
export const SOCIAL_PLATFORMS: { value: SocialPlatform; label: string; example: string }[] = [
  { value: "linkedin", label: "LinkedIn", example: "https://www.linkedin.com/in/your-name" },
  { value: "x", label: "X (Twitter)", example: "https://x.com/your-handle" },
  { value: "facebook", label: "Facebook", example: "https://www.facebook.com/your-name" },
  { value: "instagram", label: "Instagram", example: "https://www.instagram.com/your-handle" },
  { value: "youtube", label: "YouTube", example: "https://www.youtube.com/@your-channel" },
  { value: "github", label: "GitHub", example: "https://github.com/your-name" },
  { value: "researchgate", label: "ResearchGate", example: "https://www.researchgate.net/profile/Your-Name" },
  { value: "orcid", label: "ORCID", example: "https://orcid.org/0000-0000-0000-0000" },
  { value: "google_scholar", label: "Google Scholar", example: "https://scholar.google.com/citations?user=..." },
  { value: "website", label: "Website", example: "https://your-site.com" },
];

export const socialLabel = (platform: SocialPlatform) =>
  SOCIAL_PLATFORMS.find((item) => item.value === platform)?.label ?? "Link";

// Writers, reviewers and editors get education, social links and a photo.
export const hasExtendedProfile = (role: Role) => role !== "reader";

// People often paste "linkedin.com/in/me". The API needs a full address, so add https://.
export function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

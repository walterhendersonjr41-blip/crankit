/** Vite base, always with a trailing slash. On GitHub Pages this is `/crankit/`. */
const fromVite = import.meta.env.BASE_URL;
export const BASE_URL = fromVite && fromVite !== "/" ? fromVite : "/crankit/";

export function withBase(path = ""): string {
  const trimmed = path.replace(/^\//, "");
  return `${BASE_URL}${trimmed}`;
}

export function privacyHref(): string {
  return withBase("privacy");
}

export function isPrivacyPath(pathname = window.location.pathname, hash = window.location.hash): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/privacy" || path.endsWith("/privacy")) return true;
  const h = hash.replace(/^#\/?/, "");
  return h === "privacy";
}

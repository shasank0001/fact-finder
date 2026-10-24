const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export const API_ENDPOINTS = {
  NEWS: { ANALYZE: `${base}/news/verify` },
  IMAGES: { ANALYZE: `${base}/image/analyze` },
  JOBS: { ANALYZE: `${base}/job/analyze` },
  ECOMMERCE: { ANALYZE: `${base}/ecommerce/analyze-advanced` },
};
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, { ...options, credentials: "include" });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === "string" ? error.detail : `Request failed (${response.status})`);
  }
  return response.json();
}

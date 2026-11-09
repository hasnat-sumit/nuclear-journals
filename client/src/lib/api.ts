import type { Paginated } from "./types";

const REQUEST_TIMEOUT_MS = 8000;

function apiUrl(path: string) {
  return `${process.env.API_URL ?? "http://localhost:4000"}/api/v1${path}`;
}

// Public data for server-rendered pages. These pages stay dynamic so a published or
// unpublished article is reflected immediately. Returns null when something is
// missing; network and server failures throw and reach the nearest error.tsx.
export async function getPublic<T>(path: string): Promise<T | null> {
  const response = await fetch(apiUrl(path), {
    headers: { "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public API request failed with status ${response.status}`);
  return (await response.json()) as T;
}

export async function getPublicData<T>(path: string): Promise<T | null> {
  const body = await getPublic<{ data: T }>(path);
  return body ? body.data : null;
}

export async function getPublicList<T>(path: string): Promise<Paginated<T>> {
  const body = await getPublic<Paginated<T>>(path);
  return body ?? { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 1 } };
}

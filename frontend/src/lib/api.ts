import type { MetaResponse, TimelineRequest, TimelineResponse } from "./types";

/** No browser usa API pública (evita timeout do proxy Next). No SSR usa URL interna. */
function getApiBase(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "";
  }
  return process.env.API_INTERNAL_URL || "http://localhost:8000";
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export function getMeta(): Promise<MetaResponse> {
  return fetchJson("/api/meta");
}

export function postTimeline(body: TimelineRequest): Promise<TimelineResponse> {
  return fetchJson("/api/timeline", { method: "POST", body: JSON.stringify(body) });
}

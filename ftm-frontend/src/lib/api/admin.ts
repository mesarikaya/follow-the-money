import { BACKEND, get } from "./http";

/** Operational endpoints: raw signal history, ingestion status, and the ticker→category map. */

export type SignalHistoryEntry = {
  signalDate: string;
  signalType: string;
  value: number;
  computedAt: string;
};

export type IngestStatusEntry = {
  runId: string;
  source: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  rowsInserted: number | null;
};

export type TickerMappingDto = {
  ticker: string;
  categoryId: string;
  notes: string | null;
  updatedAt: string;
};

export type TickerMappingRequest = {
  ticker: string;
  categoryId: string;
  notes?: string;
};

export const fetchSignalHistory = (categoryId: string, days = 90) =>
  get<SignalHistoryEntry[]>(`/api/v1/signals/${categoryId.toUpperCase()}?days=${days}`);

export const fetchLatestIngestStatus = () => get<IngestStatusEntry[]>("/api/v1/ingest/status/latest");

export const fetchTickerMappings = () => get<TickerMappingDto[]>("/api/v1/admin/ticker-mappings");

export const upsertTickerMapping = (request: TickerMappingRequest): Promise<TickerMappingDto> =>
  fetch(`${BACKEND}/api/v1/admin/ticker-mappings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `POST /api/v1/admin/ticker-mappings → ${res.status}`);
    }
    return res.json() as Promise<TickerMappingDto>;
  });

export const deleteTickerMapping = (ticker: string): Promise<void> =>
  fetch(`${BACKEND}/api/v1/admin/ticker-mappings/${encodeURIComponent(ticker)}`, {
    method: "DELETE",
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`DELETE /api/v1/admin/ticker-mappings/${ticker} → ${res.status}`);
  });

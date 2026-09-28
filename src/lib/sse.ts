/* ============================================================
   Klien SSE berbasis fetch + ReadableStream.

   EventSource tidak bisa menyertakan header Authorization, sedangkan
   backend mengautentikasi via bearer token. Klien ini memakai fetch
   streaming agar token tetap terkirim, lalu mem-parse frame text/event-stream
   secara manual. Menyambung ulang otomatis dengan jeda bertingkat.
   ============================================================ */

import { AUTH_UNAUTHORIZED_EVENT, getToken } from "@/lib/api";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/api";

export type SseStatus = "connecting" | "open" | "closed";

export interface SseMessage {
  event: string;
  data: unknown;
}

type MessageHandler = (msg: SseMessage) => void;
type StatusHandler = (status: SseStatus) => void;

export class SseClient {
  private path: string;
  private controller: AbortController | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private status: SseStatus = "closed";
  private retry = 0;
  private stopped = true;
  private reconnectTimer: number | null = null;

  constructor(path: string) {
    this.path = path;
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): SseStatus {
    return this.status;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.controller?.abort();
    this.controller = null;
    this.setStatus("closed");
  }

  private setStatus(status: SseStatus): void {
    this.status = status;
    for (const h of this.statusHandlers) h(status);
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    // Backoff bertingkat: 1s, 2s, 4s, … maks 30s.
    const delay = Math.min(30000, 1000 * 2 ** this.retry);
    this.retry += 1;
    this.reconnectTimer = window.setTimeout(() => void this.connect(), delay);
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;

    const token = getToken();
    if (!token) {
      this.setStatus("closed");
      return;
    }

    this.setStatus("connecting");
    this.controller = new AbortController();

    try {
      const res = await fetch(`${BASE_URL}${this.path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        signal: this.controller.signal
      });

      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
        this.stop();
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`SSE gagal (${res.status})`);
      }

      this.setStatus("open");
      this.retry = 0;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Frame dipisah baris kosong (\n\n).
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          this.dispatchFrame(raw);
        }
      }
      // Stream berakhir normal → sambung ulang.
      if (!this.stopped) this.scheduleReconnect();
    } catch (err) {
      if (this.controller?.signal.aborted) return;
      if (!this.stopped) this.scheduleReconnect();
    }
  }

  private dispatchFrame(raw: string): void {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;

    const dataStr = dataLines.join("\n");
    let data: unknown = dataStr;
    try {
      data = JSON.parse(dataStr);
    } catch {
      /* biarkan string mentah */
    }

    const msg: SseMessage = { event, data };
    for (const h of this.messageHandlers) h(msg);
  }
}

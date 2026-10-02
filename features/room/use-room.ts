"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomView } from "./project";
import type { Command } from "./engine";
export function useRoom(code: string, display = false) {
  const [generation, setGeneration] = useState(0);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const ref = useRef<RoomView | null>(null);
  const pending = useRef(false);
  const apply = useCallback((next: RoomView) => {
    if (!ref.current || next.serverNow >= ref.current.serverNow) {
      ref.current = next;
      setRoom(next);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    let stream: EventSource | null = null;
    let failures = 0;
    const url = `/api/rooms/${code}${display ? "?display=1" : ""}`;
    async function refresh() {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (alive) {
          apply(data);
          setError("");
          failures = 0;
        }
      } catch (e) {
        if (alive) {
          failures++;
          if (!ref.current || failures > 2) setError((e as Error).message);
        }
      }
    }
    void refresh();
    stream = new EventSource(
      `/api/rooms/${code}/events${display ? "?display=1" : ""}`,
    );
    stream.onopen = () => {
      if (alive) setConnected(true);
    };
    stream.onmessage = (e) => {
      if (alive) {
        apply(JSON.parse(e.data));
        setConnected(true);
        setError("");
      }
    };
    stream.onerror = () => {
      if (alive) setConnected(false);
    };
    stream.addEventListener("problem", (e) => {
      if (alive) setError(JSON.parse((e as MessageEvent).data).error);
    });
    const fallback = setInterval(() => {
      if (stream?.readyState !== EventSource.OPEN) void refresh();
    }, 2500);
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    return () => {
      alive = false;
      stream?.close();
      clearInterval(fallback);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", visible);
    };
  }, [code, display, apply, generation]);
  const send = useCallback(
    async (c: Omit<Command, "requestId"> | { type: "join"; name: string }) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      setError("");
      try {
        const response = await fetch(`/api/rooms/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...c,
            requestId:
              globalThis.crypto?.randomUUID?.() ??
              `request-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        apply(data);
        if (c.type === "join") setGeneration((n) => n + 1);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      } finally {
        setBusy(false);
        pending.current = false;
      }
    },
    [code, apply],
  );
  return { room, error, busy, connected, send, clearError: () => setError("") };
}

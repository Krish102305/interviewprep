"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomState } from "@/lib/services/room";

export type ClientRoomState = Omit<RoomState, "startedAt" | "pausedAt" | "scheduledAt"> & { startedAt: string | null; pausedAt: string | null; scheduledAt: string | null };

/**
 * Polls the role-filtered room state. Tracks consecutive failures so the UI can
 * show "Connection interrupted — trying to reconnect…" and log a technical event
 * (never a conduct event) once we recover.
 */
export function useRoomState(id: string, intervalMs = 2000) {
  const [state, setState] = useState<ClientRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const failures = useRef(0);
  const lostAt = useRef<number | null>(null);
  const clockOffset = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/interviews/${id}/state`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status >= 500) throw new Error(data?.error ?? "Server error");
        setError(data?.error ?? "Unable to load interview.");
        return null;
      }
      clockOffset.current = new Date(data.serverNow).getTime() - Date.now();
      setState(data);
      setError(null);
      if (failures.current >= 2 && lostAt.current) {
        const secs = Math.round((Date.now() - lostAt.current) / 1000);
        fetch(`/api/interviews/${id}/technical`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "reconnected", details: `Recovered after ~${secs}s` }) }).catch(() => {});
      }
      failures.current = 0;
      lostAt.current = null;
      setOffline(false);
      return data as ClientRoomState;
    } catch {
      failures.current += 1;
      if (failures.current === 2) {
        lostAt.current = Date.now();
        setOffline(true);
      }
      return null;
    }
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, intervalMs);
    const online = () => refresh();
    window.addEventListener("online", online);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", online);
    };
  }, [refresh, intervalMs]);

  const serverNow = useCallback(() => Date.now() + clockOffset.current, []);
  return { state, setState, refresh, error, offline, serverNow };
}

/** Seconds elapsed in the interview (excludes paused time). */
export function useElapsed(startedAt: string | null, pausedAt: string | null, serverNow: () => number) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(t);
  }, [serverNow]);
  if (!startedAt) return 0;
  const end = pausedAt ? new Date(pausedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000));
}

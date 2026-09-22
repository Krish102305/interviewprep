"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

type Slot = { id: string; startsAt: string; endsAt: string; interview: { id: string; targetRole: string } | null };

export function AvailabilityManager({ slots }: { slots: Slot[] }) {
  const router = useRouter();
  const toast = useToast();
  const [start, setStart] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [repeat, setRepeat] = useState("1");
  const [busy, setBusy] = useState(false);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const minDate = new Date(Date.now() + 30 * 60_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  async function add() {
    if (!start) return toast.error("Pick a start time.");
    setBusy(true);
    try {
      const r = await api<{ created: number }>("/api/interviewer/availability", { body: { startsAt: new Date(start).toISOString(), durationMinutes: Number(minutes), repeatWeeks: Number(repeat), timezone: tz } });
      toast.success(`Added ${r.created} slot${r.created === 1 ? "" : "s"}.`);
      setStart("");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await api(`/api/interviewer/availability/${id}`, { method: "DELETE" });
      toast.success("Slot removed.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <Card>
        <CardHeader title="Add availability" description={`Times are in your time zone (${tz}).`} />
        <CardBody className="space-y-4">
          <Input label="Start" type="datetime-local" min={minDate} value={start} onChange={(e) => setStart(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Length" value={minutes} onChange={(e) => setMinutes(e.target.value)}>
              {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
            <Select label="Repeat weekly" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              {[1, 2, 4, 8].map((w) => <option key={w} value={w}>{w === 1 ? "Just once" : `${w} weeks`}</option>)}
            </Select>
          </div>
          <Button onClick={add} loading={busy} className="w-full"><CalendarPlus className="h-4 w-4" /> Add slot</Button>
          <p className="text-xs text-ink-500">Students can book any open slot at least as long as their interview. Overlapping slots and double bookings are prevented automatically.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Your upcoming slots" />
        <CardBody>
          {slots.length ? (
            <ul className="divide-y divide-ink-100">
              {slots.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{new Date(s.startsAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} – {new Date(s.endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                    {s.interview ? <Badge tone="olive" className="mt-1">Booked · {s.interview.targetRole}</Badge> : <Badge className="mt-1">Open</Badge>}
                  </div>
                  {!s.interview && <Button size="sm" variant="ghost" onClick={() => remove(s.id)} aria-label="Remove slot"><Trash2 className="h-4 w-4" /></Button>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No availability yet" description="Add a few slots so students can book interviews with you." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

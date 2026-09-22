export function EvidenceBlock({ evidence }: { evidence: string }) {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(evidence);
  } catch {
    parsed = evidence;
  }
  const obj = (parsed ?? {}) as { conductEvents?: { type: string; details?: string; at: string; source?: string }[]; technicalEvents?: { type: string; details?: string; at: string }[]; note?: string };
  const hasEvents = Boolean(obj.conductEvents?.length || obj.technicalEvents?.length);
  return (
    <div className="space-y-3 text-xs">
      {obj.conductEvents?.length ? (
        <div>
          <p className="font-semibold text-ink-700">Conduct signals</p>
          <ul className="mt-1 space-y-0.5 text-ink-600">{obj.conductEvents.map((e, i) => <li key={i}>{new Date(e.at).toLocaleString()} — {e.type.replaceAll("_", " ")}{e.source ? ` (${e.source})` : ""}{e.details ? `: ${e.details}` : ""}</li>)}</ul>
        </div>
      ) : null}
      {obj.technicalEvents?.length ? (
        <div>
          <p className="font-semibold text-amber-800">Technical events (not misconduct)</p>
          <ul className="mt-1 space-y-0.5 text-ink-600">{obj.technicalEvents.map((e, i) => <li key={i}>{new Date(e.at).toLocaleString()} — {e.type.replaceAll("_", " ")}{e.details ? `: ${e.details}` : ""}</li>)}</ul>
        </div>
      ) : null}
      {obj.note && <p className="text-ink-500">{obj.note}</p>}
      {!hasEvents && !obj.note && <p className="text-ink-400">No automated evidence attached.</p>}
    </div>
  );
}

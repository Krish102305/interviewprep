"use client";
import { useEffect, useRef } from "react";
import { MicOff, VideoOff } from "lucide-react";
import { cn } from "@/lib/cn";

export function VideoTile({ stream, muted, label, sublabel, camOn = true, micOn = true, initials, mirrored, className, overlay }: { stream: MediaStream | null; muted?: boolean; label: string; sublabel?: string; camOn?: boolean; micOn?: boolean; initials: string; mirrored?: boolean; className?: string; overlay?: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  const hasVideo = Boolean(stream?.getVideoTracks().some((t) => t.readyState === "live")) && camOn;
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-ink-800", className)}>
      <video ref={ref} autoPlay playsInline muted={muted} className={cn("h-full w-full object-cover", mirrored && "-scale-x-100", !hasVideo && "invisible")} aria-label={`${label} video`} />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-ink-700 to-ink-900">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-xl font-semibold text-white sm:h-20 sm:w-20">{initials}</span>
          <span className="mt-3 flex items-center gap-1.5 text-xs text-ink-300"><VideoOff className="h-3.5 w-3.5" /> Camera off</span>
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur">
        <span className="font-medium">{label}</span>
        {sublabel && <span className="text-white/70">· {sublabel}</span>}
        {!micOn && <MicOff className="h-3.5 w-3.5 text-red-300" aria-label="Muted" />}
      </div>
      {overlay}
    </div>
  );
}

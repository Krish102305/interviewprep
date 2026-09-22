import { WifiOff } from "lucide-react";
import { Spinner } from "@/components/ui/feedback";

export function ConnectionOverlay({ show, message = "Trying to reconnect…" }: { show: boolean; message?: string }) {
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex justify-center p-3" role="status" aria-live="assertive">
      <div className="flex items-center gap-3 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-ink-950 shadow-lift">
        <WifiOff className="h-4 w-4" /> Connection interrupted <span className="hidden sm:inline">· {message}</span> <Spinner className="h-4 w-4" />
      </div>
    </div>
  );
}

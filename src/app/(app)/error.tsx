"use client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <Alert tone="danger" title="Something went wrong loading this page">Your data is safe. Try again, and if the problem continues, refresh the page.</Alert>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}

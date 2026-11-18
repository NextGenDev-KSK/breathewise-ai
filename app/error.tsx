"use client";

import { ErrorState } from "@/components/ui/States";

/** Route-level error boundary. Shows a generic message; details stay in the console. */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="Something went wrong on this page"
      message="An unexpected error occurred. You can try again."
      onRetry={reset}
    />
  );
}

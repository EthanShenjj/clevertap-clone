"use client";
import { ErrorState } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      message="An unexpected issue interrupted this page. Your saved data is still available."
      retry={reset}
    />
  );
}

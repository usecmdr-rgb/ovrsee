"use client";

import React from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4" role="alert">
      <h1 className="text-2xl font-semibold">Something went wrong!</h1>
      {error.message && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {error.message}
        </p>
      )}
      <button
        onClick={() => reset()}
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:focus-visible:outline-white"
        aria-label="Try again to reload the page"
      >
        Try again
      </button>
    </main>
  );
}



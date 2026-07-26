import type { UseQueryResult } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";

import { Skeleton } from "./Skeleton.js";

type SkeletonType = "table-rows" | "card" | "inline" | "full-container-size";

type Props<TData, TError = Error> = {
  query: UseQueryResult<TData, TError>;
  delayMs?: number;
  children: (data: TData) => ReactNode;
  error?: (error: TError) => ReactNode;
} & (
  | { skeletonType: SkeletonType; pending?: never }
  | { pending: () => ReactNode; skeletonType?: never }
);

function SkeletonPreset({ type }: { type: SkeletonType }) {
  switch (type) {
    case "table-rows":
      return (
        <div className="space-y-2 py-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    case "card":
      return (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      );
    case "inline":
      return <Skeleton className="h-10 w-full" />;
    case "full-container-size":
      return <Skeleton className="h-[800px] w-full" />;
  }
}

export function QueryGuard<TData, TError = Error>(props: Props<TData, TError>) {
  const { query, delayMs = 500, children, error } = props;

  const [pastThreshold, setPastThreshold] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setPastThreshold(true), delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs]);

  if (query.isSuccess) {
    return <>{children(query.data)}</>;
  }

  if (query.status === "pending" && pastThreshold) {
    if ("pending" in props && props.pending) {
      return <>{props.pending()}</>;
    }
    if ("skeletonType" in props && props.skeletonType) {
      return <SkeletonPreset type={props.skeletonType} />;
    }
  }

  if (query.isError) {
    if (error) {
      return <>{error(query.error)}</>;
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-4xl font-bold">Error</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          {query.error instanceof Error
            ? query.error.message
            : "An unexpected error occurred."}
        </p>
      </div>
    );
  }

  return null;
}

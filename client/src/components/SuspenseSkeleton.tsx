import { type ReactNode, useEffect, useState } from "react";

export function SuspenseSkeleton({
  delayMs = 500,
  children,
}: {
  delayMs?: number;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs]);

  if (!show) return null;

  return <>{children}</>;
}

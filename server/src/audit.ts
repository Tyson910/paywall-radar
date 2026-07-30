export function audit(event: string, details: Record<string, unknown> = {}): void {
  console.info(
    JSON.stringify({
      type: "audit",
      event,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

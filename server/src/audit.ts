import { log } from "./logger.js";

export function audit(event: string, details: Record<string, unknown> = {}): void {
  log.info({ type: "audit", event, ...details }, event);
}

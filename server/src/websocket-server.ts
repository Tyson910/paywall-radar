import type { serve } from "@hono/node-server";

import { WebSocketServer } from "ws";

type HonoWebSocketServer = NonNullable<
  NonNullable<Parameters<typeof serve>[0]["websocket"]>["server"]
>;

function isHonoWebSocketServer(value: unknown): value is HonoWebSocketServer {
  if (typeof value !== "object" || value === null || !("options" in value)) return false;

  const options: unknown = value.options;
  return (
    typeof options === "object" &&
    options !== null &&
    "noServer" in options &&
    options.noServer === true &&
    "on" in value &&
    typeof value.on === "function" &&
    "off" in value &&
    typeof value.off === "function" &&
    "emit" in value &&
    typeof value.emit === "function" &&
    "handleUpgrade" in value &&
    typeof value.handleUpgrade === "function" &&
    "close" in value &&
    typeof value.close === "function"
  );
}

export function createWebSocketServer(): HonoWebSocketServer {
  const server: unknown = new WebSocketServer({ noServer: true });
  if (!isHonoWebSocketServer(server)) {
    throw new Error("WebSocket server does not satisfy Hono's server interface");
  }
  return server;
}

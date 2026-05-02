import type { MiddlewareHandler } from "hono";
import { DEVICE_ID_HEADER } from "@cyaccess/shared";

export type DeviceContext = {
  Variables: {
    deviceId: string;
  };
};

export const deviceAuth: MiddlewareHandler<DeviceContext> = async (c, next) => {
  const deviceId = c.req.header(DEVICE_ID_HEADER);
  if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
    return c.json({ error: "Missing or invalid device ID header" }, 401);
  }
  c.set("deviceId", deviceId);
  await next();
};

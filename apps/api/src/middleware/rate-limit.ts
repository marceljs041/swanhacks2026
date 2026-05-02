import type { MiddlewareHandler } from "hono";
import { supabase } from "../lib/supabase";
import type { DeviceContext } from "./device-auth";

type RateLimitOptions = {
  action: string;
  max: number;
  windowSeconds: number;
};

/**
 * Simple fixed-window rate limiter backed by the `device_rate_limits` table.
 * Keyed on `(device_id, action, window_start)`. Falls open on DB error so we
 * never lock users out of accessibility features.
 */
export function rateLimit(opts: RateLimitOptions): MiddlewareHandler<DeviceContext> {
  return async (c, next) => {
    const deviceId = c.get("deviceId");
    const windowStart = new Date(
      Math.floor(Date.now() / (opts.windowSeconds * 1000)) * opts.windowSeconds * 1000,
    ).toISOString();

    try {
      const { data: existing } = await supabase
        .from("device_rate_limits")
        .select("id,count")
        .eq("device_id", deviceId)
        .eq("action", opts.action)
        .eq("window_start", windowStart)
        .maybeSingle();

      const currentCount = existing?.count ?? 0;
      if (currentCount >= opts.max) {
        return c.json(
          { error: "Rate limit exceeded. Please slow down." },
          429,
        );
      }

      if (existing) {
        await supabase
          .from("device_rate_limits")
          .update({ count: currentCount + 1 })
          .eq("id", existing.id);
      } else {
        await supabase.from("device_rate_limits").insert({
          device_id: deviceId,
          action: opts.action,
          count: 1,
          window_start: windowStart,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("rate-limit check failed (falling open):", err);
    }

    await next();
  };
}

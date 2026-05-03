/**
 * Hook returning the current local time as minutes-since-midnight.
 * Re-renders every minute so the now-line in the timed grids stays
 * accurate without churning state on every animation frame.
 */
import { useEffect, useState } from "react";

function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function useNowMinutes(): number {
  const [m, setM] = useState<number>(() => nowMin());
  useEffect(() => {
    let timer: number | undefined;
    function tick(): void {
      setM(nowMin());
      const ms = 60_000 - (Date.now() % 60_000);
      timer = window.setTimeout(tick, ms);
    }
    tick();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);
  return m;
}

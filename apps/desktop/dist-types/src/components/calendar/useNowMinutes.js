/**
 * Hook returning the current local time as minutes-since-midnight.
 * Re-renders every minute so the now-line in the timed grids stays
 * accurate without churning state on every animation frame.
 */
import { useEffect, useState } from "react";
function nowMin() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}
export function useNowMinutes() {
    const [m, setM] = useState(() => nowMin());
    useEffect(() => {
        let timer;
        function tick() {
            setM(nowMin());
            const ms = 60_000 - (Date.now() % 60_000);
            timer = window.setTimeout(tick, ms);
        }
        tick();
        return () => {
            if (timer !== undefined)
                window.clearTimeout(timer);
        };
    }, []);
    return m;
}
//# sourceMappingURL=useNowMinutes.js.map
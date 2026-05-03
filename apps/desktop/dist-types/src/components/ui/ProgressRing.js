import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Donut progress ring rendered as two concentric circles. Uses
 * `stroke-dasharray` to display the filled arc — works at any size and
 * inherits theme colours by default.
 */
export const ProgressRing = ({ value, size = 96, thickness = 10, trackColor = "var(--color-surfaceMuted)", color = "var(--color-primary)", children, }) => {
    const r = (size - thickness) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(1, value));
    const dash = c * clamped;
    return (_jsxs("div", { className: "ring-wrap", style: { width: size, height: size }, children: [_jsxs("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, children: [_jsx("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: trackColor, strokeWidth: thickness }), _jsx("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: color, strokeWidth: thickness, strokeLinecap: "round", strokeDasharray: `${dash} ${c - dash}`, transform: `rotate(-90 ${size / 2} ${size / 2})`, style: { transition: "stroke-dasharray 320ms cubic-bezier(0.2,0,0,1)" } })] }), children && _jsx("div", { className: "ring-label", children: children })] }));
};
/** Multi-segment donut for breakdowns like flashcard deck distribution. */
export const Donut = ({ segments, size = 100, thickness = 12, trackColor = "var(--color-surfaceMuted)", children, }) => {
    const r = (size - thickness) / 2;
    const c = 2 * Math.PI * r;
    const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;
    let offset = 0;
    return (_jsxs("div", { className: "donut-wrap", style: { width: size, height: size }, children: [_jsxs("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, children: [_jsx("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: trackColor, strokeWidth: thickness }), segments.map((s, i) => {
                        const len = (s.value / total) * c;
                        const dasharray = `${len} ${c - len}`;
                        const dashoffset = -offset;
                        offset += len;
                        return (_jsx("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: s.color, strokeWidth: thickness, strokeDasharray: dasharray, strokeDashoffset: dashoffset, transform: `rotate(-90 ${size / 2} ${size / 2})`, strokeLinecap: "butt" }, i));
                    })] }), children && _jsx("div", { className: "donut-center", children: children })] }));
};
//# sourceMappingURL=ProgressRing.js.map
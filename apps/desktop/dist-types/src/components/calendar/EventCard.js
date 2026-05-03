import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fmtTimeRange, iconForEvent, toneForEvent } from "./eventVisuals.js";
export const EventCard = ({ event, cls, variant = "timed", selected, onClick, style, onMoveStart, onResizeStart, }) => {
    const tone = toneForEvent(event, cls);
    const isCompleted = event.status === "completed";
    const isAi = event.source_type === "ai_generated";
    const subtitle = subtitleFor(event, cls);
    const timeLine = fmtTimeRange(event.start_at, event.end_at, !!event.all_day);
    const ariaLabel = [event.title, timeLine, subtitle].filter(Boolean).join(". ");
    const className = [
        "cal-event",
        `tone-${tone}`,
        `cal-event--${variant}`,
        selected ? "is-selected" : "",
        isCompleted ? "is-completed" : "",
        isAi ? "is-ai" : "",
    ]
        .filter(Boolean)
        .join(" ");
    // Forward mousedown to the parent so it can register the drag intent
    // (move). The parent uses a movement threshold before promoting the
    // intent to a real drag; if the user releases without moving, this
    // element receives a normal `click` and selection works as expected.
    const handleMouseDown = (e) => {
        if (!onMoveStart || e.button !== 0)
            return;
        if (e.target.closest(".cal-event-resize"))
            return;
        onMoveStart(e);
    };
    const handleClick = () => {
        onClick?.();
    };
    const handleKey = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
        }
    };
    return (_jsxs("div", { className: className, style: style, role: onClick ? "button" : undefined, tabIndex: onClick ? 0 : undefined, onClick: onClick ? handleClick : undefined, onMouseDown: handleMouseDown, onKeyDown: onClick ? handleKey : undefined, "aria-label": ariaLabel, children: [_jsxs("div", { className: "cal-event-tooltip", "aria-hidden": "true", children: [_jsx("span", { className: "cal-event-tooltip-title", children: event.title }), _jsx("span", { className: "cal-event-tooltip-meta", children: timeLine }), subtitle ? (_jsx("span", { className: "cal-event-tooltip-detail", children: subtitle })) : null] }), variant !== "month" && (_jsx("span", { className: "cal-event-icon", "aria-hidden": true, children: iconForEvent(event, 12) })), _jsxs("span", { className: "cal-event-body", children: [_jsx("span", { className: "cal-event-title", children: event.title }), variant === "month" ? null : (_jsx("span", { className: "cal-event-meta", children: timeLine }))] }), variant === "timed" && onResizeStart && (_jsx("div", { className: "cal-event-resize", "aria-hidden": true, onMouseDown: (e) => {
                    onResizeStart(e);
                } }))] }));
};
function subtitleFor(event, cls) {
    if (cls)
        return cls.code ?? cls.name;
    if (event.location)
        return event.location;
    return null;
}
//# sourceMappingURL=EventCard.js.map
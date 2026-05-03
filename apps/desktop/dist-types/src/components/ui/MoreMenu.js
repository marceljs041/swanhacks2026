import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreIcon } from "../icons.js";
/**
 * A small dropdown menu hung off the standard `…` (more) button used in
 * card headers. Closes on outside click and Esc, and traps focus only
 * loosely — the list is short enough that arrow-key navigation isn't
 * worth the complexity here.
 */
export const MoreMenu = ({ items, label = "More actions" }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const btnRef = useRef(null);
    const [placement, setPlacement] = useState(null);
    useLayoutEffect(() => {
        if (!open) {
            setPlacement(null);
            return;
        }
        function update() {
            if (!btnRef.current)
                return;
            const r = btnRef.current.getBoundingClientRect();
            setPlacement({
                top: r.bottom + 4,
                right: Math.max(8, window.innerWidth - r.right),
            });
        }
        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        /** Capture phase so we beat other handlers and close reliably (e.g. note editor layout). */
        function onOutside(e) {
            if (!wrapRef.current?.contains(e.target))
                setOpen(false);
        }
        function onKey(e) {
            if (e.key === "Escape")
                setOpen(false);
        }
        document.addEventListener("pointerdown", onOutside, true);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onOutside, true);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);
    return (_jsxs("div", { className: "more-menu", ref: wrapRef, onPointerDown: (e) => e.stopPropagation(), children: [_jsx("button", { ref: btnRef, type: "button", className: "more-menu-trigger", "aria-label": label, "aria-haspopup": "menu", "aria-expanded": open, onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                    e.stopPropagation();
                    setOpen((v) => !v);
                }, children: _jsx(MoreIcon, { size: 18 }) }), open && placement && (_jsx("div", { className: "more-menu-list", role: "menu", style: {
                    position: "fixed",
                    top: placement.top,
                    right: placement.right,
                    zIndex: 450,
                }, children: items.map((it, i) => (_jsxs("button", { type: "button", role: "menuitem", className: `more-menu-item${it.danger ? " danger" : ""}`, onClick: () => {
                        setOpen(false);
                        it.onClick();
                    }, children: [it.icon && _jsx("span", { className: "more-menu-icon", children: it.icon }), _jsx("span", { children: it.label })] }, `${i}-${it.label}`))) }))] }));
};
//# sourceMappingURL=MoreMenu.js.map
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MoreIcon } from "../icons.js";
import { MoreMenu } from "./MoreMenu.js";
/** Generic dashboard card with optional header (icon + title + action). */
export const Card = ({ title, icon, action, className, bodyClassName, children, }) => {
    const showHeader = title !== undefined || icon !== undefined || action !== undefined;
    return (_jsxs("div", { className: `card ${className ?? ""}`, children: [showHeader && (_jsxs("div", { className: "card-header", children: [icon && _jsx("span", { className: "header-icon", children: icon }), title && _jsx("h3", { children: title }), Array.isArray(action) ? (_jsx("div", { className: "header-action-wrap", children: _jsx(MoreMenu, { items: action }) })) : action === "more" ? (_jsx("button", { type: "button", className: "header-action", "aria-label": "More", children: _jsx(MoreIcon, { size: 16 }) })) : action ? (_jsx("div", { className: "header-action-wrap", children: action })) : null] })), _jsx("div", { className: bodyClassName ?? "", style: { display: "contents" }, children: children })] }));
};
//# sourceMappingURL=Card.js.map
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SparklesIcon } from "../icons.js";
/**
 * Standard "this part of the UI exists but isn't wired up yet" surface.
 * Drop it into any screen to make the unfinished state explicit instead
 * of pretending the feature works.
 */
export const Placeholder = ({ title = "Not yet implemented", description, icon, }) => (_jsxs("div", { className: "placeholder", role: "status", children: [_jsx("div", { className: "ph-icon", children: icon ?? _jsx(SparklesIcon, { size: 22 }) }), _jsx("div", { className: "ph-title", children: title }), description && _jsx("div", { className: "ph-sub", children: description })] }));
//# sourceMappingURL=Placeholder.js.map
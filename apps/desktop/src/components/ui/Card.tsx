import type { FC, ReactNode } from "react";
import { MoreIcon } from "../icons.js";
import { MoreMenu, type MoreMenuItem } from "./MoreMenu.js";

interface Props {
  title?: string;
  icon?: ReactNode;
  /**
   * Header action slot. Use:
   *  - `"more"` to render an inert `…` button (kept for cards that
   *    don't have a menu yet).
   *  - A `MoreMenuItem[]` to render a real dropdown.
   *  - Any ReactNode for a custom action.
   */
  action?: ReactNode | "more" | MoreMenuItem[];
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

/** Generic dashboard card with optional header (icon + title + action). */
export const Card: FC<Props> = ({
  title,
  icon,
  action,
  className,
  bodyClassName,
  children,
}) => {
  const showHeader = title !== undefined || icon !== undefined || action !== undefined;
  return (
    <div className={`card ${className ?? ""}`}>
      {showHeader && (
        <div className="card-header">
          {icon && <span className="header-icon">{icon}</span>}
          {title && <h3>{title}</h3>}
          {Array.isArray(action) ? (
            <div className="header-action-wrap">
              <MoreMenu items={action} />
            </div>
          ) : action === "more" ? (
            <button type="button" className="header-action" aria-label="More">
              <MoreIcon size={16} />
            </button>
          ) : action ? (
            <div className="header-action-wrap">{action}</div>
          ) : null}
        </div>
      )}
      <div className={bodyClassName ?? ""} style={{ display: "contents" }}>
        {children}
      </div>
    </div>
  );
};

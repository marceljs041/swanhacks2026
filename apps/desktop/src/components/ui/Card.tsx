import type { FC, ReactNode } from "react";
import { MoreIcon } from "../icons.js";

interface Props {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode | "more";
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
          {action === "more" ? (
            <button className="header-action" aria-label="More">
              <MoreIcon size={16} />
            </button>
          ) : action ? (
            <div className="header-action" style={{ width: "auto", padding: "0 4px" }}>
              {action}
            </div>
          ) : null}
        </div>
      )}
      <div className={bodyClassName ?? ""} style={{ display: "contents" }}>
        {children}
      </div>
    </div>
  );
};

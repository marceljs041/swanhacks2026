import type { FC, ReactNode } from "react";
import { SparklesIcon } from "../icons.js";

interface Props {
  title?: string;
  /** One-line explanation of what'll go here once it's built. */
  description?: string;
  icon?: ReactNode;
}

/**
 * Standard "this part of the UI exists but isn't wired up yet" surface.
 * Drop it into any screen to make the unfinished state explicit instead
 * of pretending the feature works.
 */
export const Placeholder: FC<Props> = ({
  title = "Not yet implemented",
  description,
  icon,
}) => (
  <div className="placeholder" role="status">
    <div className="ph-icon">{icon ?? <SparklesIcon size={22} />}</div>
    <div className="ph-title">{title}</div>
    {description && <div className="ph-sub">{description}</div>}
  </div>
);

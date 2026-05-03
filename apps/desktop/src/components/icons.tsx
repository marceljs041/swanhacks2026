/**
 * Lightweight inline SVG icon set. Stroke-based to inherit `currentColor`,
 * size via the `size` prop or surrounding `width`/`height`. Adding a new
 * glyph means dropping one more component below — no font / npm dep needed.
 */
import type { FC, SVGProps } from "react";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
}

const make = (path: JSX.Element): FC<IconProps> =>
  function Icon({ size = 18, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...rest}
      >
        {path}
      </svg>
    );
  };

export const HomeIcon = make(
  <>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  </>,
);

export const NoteIcon = make(
  <>
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </>,
);

export const ClassIcon = make(
  <>
    <path d="M4 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4Z" />
    <path d="M4 5v14" />
    <path d="M8 9h8M8 13h6" />
  </>,
);

export const FlashcardIcon = make(
  <>
    <rect x="3" y="6" width="14" height="11" rx="2" />
    <path d="M7 6V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-2" />
    <path d="M7 11h6" />
  </>,
);

export const QuizIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7v.5" />
    <path d="M12 17h.01" />
  </>,
);

export const CalendarIcon = make(
  <>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17" />
    <path d="M8 3v4M16 3v4" />
  </>,
);

export const SettingsIcon = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </>,
);

export const SearchIcon = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);

export const PencilIcon = make(
  <>
    <path d="M14.5 4.5 19 9l-9 9H6v-4l8.5-9.5Z" />
    <path d="m13 6 4.5 4.5" />
  </>,
);

export const MicIcon = make(
  <>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </>,
);

export const ImageIcon = make(
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="m4 19 6-6 4 4 3-3 3 3" />
  </>,
);

export const SparklesIcon = make(
  <>
    <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
    <path d="m6.5 6.5 2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" />
  </>,
);

export const FlameIcon = make(
  <>
    <path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1-3 .5 1 1 1.5 2 1.5 0-2-1-3.5-1-5 0-1 1-1.5 2-1.5Z" />
    <path d="M9 14.5a3 3 0 0 0 6 0" />
  </>,
);

export const FlagIcon = make(
  <>
    <path d="M5 3v18" />
    <path d="M5 4h12l-2 4 2 4H5" />
  </>,
);

export const TrophyIcon = make(
  <>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M16 6h3v2a3 3 0 0 1-3 3M8 6H5v2a3 3 0 0 0 3 3" />
    <path d="M10 14h4l-.5 3h-3Z" />
    <path d="M9 20h6" />
  </>,
);

export const ClockIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);

export const ChevDownIcon = make(<path d="m6 9 6 6 6-6" />);
export const ChevLeftIcon = make(<path d="m15 6-6 6 6 6" />);
export const ChevRightIcon = make(<path d="m9 6 6 6-6 6" />);
export const PlusIcon = make(<><path d="M12 5v14M5 12h14" /></>);
export const MoreIcon = make(<><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>);
export const CheckIcon = make(<path d="m5 12 5 5 9-11" />);
export const ArrowRightIcon = make(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>);
export const ArrowLeftIcon = make(<><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>);
export const XIcon = make(<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>);

export const CameraIcon = make(
  <>
    <path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </>,
);

export const UploadIcon = make(
  <>
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" />
  </>,
);

export const TrashIcon = make(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
    <path d="M10 11v6M14 11v6" />
  </>,
);

export const EyeIcon = make(
  <>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const BeakerIcon = make(
  <>
    <path d="M9 3h6" />
    <path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3" />
    <path d="M7.5 14h9" />
  </>,
);

export const GlobeIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </>,
);

export const AtomIcon = make(
  <>
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <ellipse cx="12" cy="12" rx="9" ry="3.5" />
    <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)" />
  </>,
);

export const BookIcon = make(
  <>
    <path d="M5 4h9a3 3 0 0 1 3 3v13" />
    <path d="M5 4v14a2 2 0 0 0 2 2h10" />
    <path d="M9 8h5M9 12h5" />
  </>,
);

export const MaskIcon = make(
  <>
    <path d="M4 6c2-1 4-1 8-1s6 0 8 1c0 6-3 12-8 12S4 12 4 6Z" />
    <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none" />
    <path d="M10 15c.7.5 1.3.7 2 .7s1.3-.2 2-.7" />
  </>,
);

export const WarningIcon = make(
  <>
    <path d="M12 3 2.5 20a1 1 0 0 0 .9 1.5h17.2a1 1 0 0 0 .9-1.5L12 3Z" />
    <path d="M12 10v5" />
    <path d="M12 18h.01" />
  </>,
);

export const BoltIcon = make(<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />);

export const CloudCheckIcon = make(
  <>
    <path d="M7 18h10a4 4 0 0 0 .9-7.9 6 6 0 0 0-11.8 1.2A4 4 0 0 0 7 18Z" />
    <path d="m9.5 13.5 2 2 3.5-4" />
  </>,
);

export const CloudOffIcon = make(
  <>
    <path d="M3 3l18 18" />
    <path d="M7 18h10a4 4 0 0 0 1.6-7.7" />
    <path d="M6 8a6 6 0 0 1 11 1.5" />
    <path d="M5.4 11A4 4 0 0 0 7 18" />
  </>,
);

/**
 * The Note Goat mascot. Vector-only so it scales crisp in any theme.
 * Used in the sidebar logo and the home hero. Colours follow the active
 * theme via `currentColor` for stroke and a `--logo-accent` fill var.
 */
export const GoatLogo: FC<IconProps> = ({ size = 28, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    {...rest}
    aria-hidden
  >
    {/* head */}
    <path
      d="M14 22c0-6 4-10 10-10s10 4 10 10v6c0 5-4 9-10 9s-10-4-10-9v-6Z"
      fill="var(--logo-accent, currentColor)"
      opacity="0.18"
    />
    <path
      d="M14 22c0-6 4-10 10-10s10 4 10 10v6c0 5-4 9-10 9s-10-4-10-9v-6Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    {/* horns */}
    <path
      d="M16 14c-2-3-2-6 0-7 2 0 3 2 3 5M32 14c2-3 2-6 0-7-2 0-3 2-3 5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    {/* ears */}
    <path
      d="M12 22c-3 0-5 2-5 4M36 22c3 0 5 2 5 4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    {/* eyes */}
    <circle cx="20" cy="25" r="1.4" fill="currentColor" />
    <circle cx="28" cy="25" r="1.4" fill="currentColor" />
    {/* muzzle */}
    <path
      d="M22 30h4M21 32a3 3 0 0 0 6 0"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    {/* beard */}
    <path
      d="M23 36v3M25 36v3"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

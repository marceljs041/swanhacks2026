/**
 * Lightweight inline SVG icon set. Stroke-based to inherit `currentColor`,
 * size via the `size` prop or surrounding `width`/`height`. Adding a new
 * glyph means dropping one more component below — no font / npm dep needed.
 */
import type { FC, SVGProps } from "react";
interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
    size?: number;
}
export declare const HomeIcon: FC<IconProps>;
export declare const NoteIcon: FC<IconProps>;
export declare const ClassIcon: FC<IconProps>;
export declare const FlashcardIcon: FC<IconProps>;
export declare const QuizIcon: FC<IconProps>;
export declare const CalendarIcon: FC<IconProps>;
export declare const SettingsIcon: FC<IconProps>;
export declare const SearchIcon: FC<IconProps>;
export declare const PencilIcon: FC<IconProps>;
export declare const MicIcon: FC<IconProps>;
export declare const ImageIcon: FC<IconProps>;
export declare const SparklesIcon: FC<IconProps>;
export declare const FlameIcon: FC<IconProps>;
export declare const FlagIcon: FC<IconProps>;
export declare const TrophyIcon: FC<IconProps>;
export declare const ClockIcon: FC<IconProps>;
export declare const ChevDownIcon: FC<IconProps>;
export declare const ChevLeftIcon: FC<IconProps>;
export declare const ChevRightIcon: FC<IconProps>;
export declare const PlusIcon: FC<IconProps>;
export declare const MoreIcon: FC<IconProps>;
export declare const CheckIcon: FC<IconProps>;
export declare const ArrowRightIcon: FC<IconProps>;
export declare const ArrowLeftIcon: FC<IconProps>;
export declare const XIcon: FC<IconProps>;
export declare const CameraIcon: FC<IconProps>;
export declare const UploadIcon: FC<IconProps>;
export declare const TrashIcon: FC<IconProps>;
export declare const EyeIcon: FC<IconProps>;
export declare const BeakerIcon: FC<IconProps>;
export declare const GlobeIcon: FC<IconProps>;
export declare const AtomIcon: FC<IconProps>;
export declare const BookIcon: FC<IconProps>;
export declare const MaskIcon: FC<IconProps>;
export declare const WarningIcon: FC<IconProps>;
export declare const BoltIcon: FC<IconProps>;
export declare const LeafIcon: FC<IconProps>;
export declare const PillarIcon: FC<IconProps>;
export declare const GraduationCapIcon: FC<IconProps>;
export declare const FileIcon: FC<IconProps>;
/** Archive / deactivate — tray with lid */
export declare const ArchiveIcon: FC<IconProps>;
export declare const CloudCheckIcon: FC<IconProps>;
export declare const CloudOffIcon: FC<IconProps>;
export declare const StarIcon: FC<IconProps>;
export declare const VolumeIcon: FC<IconProps>;
export declare const PlayIcon: FC<IconProps>;
export declare const HeadphonesIcon: FC<IconProps>;
export declare const ImportIcon: FC<IconProps>;
export declare const BookmarkIcon: FC<IconProps>;
export declare const TargetIcon: FC<IconProps>;
export declare const GraphIcon: FC<IconProps>;
export declare const LightningIcon: FC<IconProps>;
export declare const RestartIcon: FC<IconProps>;
/**
 * The Note Goat mascot. Vector-only so it scales crisp in any theme.
 * Used in the sidebar logo and the home hero. Colours follow the active
 * theme via `currentColor` for stroke and a `--logo-accent` fill var.
 */
export declare const GoatLogo: FC<IconProps>;
export {};
//# sourceMappingURL=icons.d.ts.map
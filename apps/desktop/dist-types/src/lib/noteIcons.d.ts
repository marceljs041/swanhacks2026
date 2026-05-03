/**
 * Per-note icon registry. The `icon` column on `notes` stores one of
 * these keys; the editor picker (added later) writes them. The notes
 * list reads them through `<NoteGlyph icon={…} />` which falls back to
 * the default `note` glyph when the key is unknown so we never blank
 * out a row because of bad data.
 */
import type { FC } from "react";
export interface NoteIconMeta {
    key: string;
    label: string;
    Icon: FC<{
        size?: number;
    }>;
}
/**
 * Ordered list so a future picker has a stable presentation. The first
 * entry is the default and what `default-icon if someone doesn't select
 * one` resolves to.
 */
export declare const NOTE_ICON_LIST: NoteIconMeta[];
export declare const DEFAULT_NOTE_ICON = "note";
export declare function getNoteIconComponent(key: string | null | undefined): FC<{
    size?: number;
}>;
interface GlyphProps {
    icon: string | null | undefined;
    size?: number;
}
export declare const NoteGlyph: FC<GlyphProps>;
export {};
//# sourceMappingURL=noteIcons.d.ts.map
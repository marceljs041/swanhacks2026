import type { FC } from "react";
interface ClassViewProps {
    classId: string;
}
export declare const ClassView: FC<ClassViewProps>;
interface Crumb {
    label: string;
    onClick?: () => void;
}
export declare const Breadcrumbs: FC<{
    trail: Crumb[];
}>;
export {};
//# sourceMappingURL=ClassView.d.ts.map
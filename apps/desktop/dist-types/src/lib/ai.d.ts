import { type AskMessage, type AskNoteSummary, type AskResponse, type ClassOverviewRequest, type ClassOverviewResponse, type FlashcardsResponse, type QuizResponse, type StudyPlanResponse, type SummaryResponse } from "@studynest/shared";
export declare const ai: {
    summarize(args: {
        note_id: string;
        title: string;
        content: string;
    }): Promise<SummaryResponse>;
    flashcards(args: {
        note_id: string;
        title: string;
        content: string;
        count?: number;
    }): Promise<FlashcardsResponse>;
    quiz(args: {
        note_id: string;
        title: string;
        content: string;
        count?: number;
    }): Promise<QuizResponse>;
    studyPlan(args: {
        goal: string;
        exam_date?: string | null;
        notes: Array<{
            id: string;
            title: string;
            summary?: string | null;
        }>;
        days_available?: number;
    }): Promise<StudyPlanResponse>;
    simpleExplain(args: {
        note_id: string;
        title: string;
        content: string;
    }): Promise<SummaryResponse>;
    ask(args: {
        class_name: string;
        class_subtitle?: string | null;
        recent_notes: AskNoteSummary[];
        weak_topics: string[];
        history: AskMessage[];
        question: string;
    }): Promise<AskResponse>;
    classOverview(args: ClassOverviewRequest): Promise<ClassOverviewResponse>;
};
//# sourceMappingURL=ai.d.ts.map
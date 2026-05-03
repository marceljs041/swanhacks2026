import { type AskMessage, type AskNoteSummary, type AskResponse, type AudioSessionChunkResponse, type AudioSessionCreateResponse, type AudioSessionFinalizeRequest, type AudioSessionFinalizeResponse, type ClassOverviewRequest, type ClassOverviewResponse, type FlashcardsResponse, type QuizResponse, type StudyPlanResponse, type SummaryResponse } from "@studynest/shared";
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
        /** Restricts question types — server may ignore unknown values. */
        types?: Array<"multiple_choice" | "true_false" | "short_answer">;
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
    /** Open a new audio session. The response tells us whether the
     * sidecar will use the real Gemma 4 backend or its placeholder stub
     * — surfaced in the toast so the user isn't lied to. */
    createAudioSession(): Promise<AudioSessionCreateResponse>;
    /** Append one ≤30s WAV chunk in order. Caller MUST await each
     * promise before sending the next chunk so the server's per-session
     * state stays in arrival order. */
    appendAudioChunk(args: {
        sessionId: string;
        chunk: Blob;
        index: number;
        total: number;
        /** Optional abort wiring — used by the toast's "Cancel" button. */
        signal?: AbortSignal;
    }): Promise<AudioSessionChunkResponse>;
    /** Send the "now make the notes" turn. Returns the structured note
     * the renderer drops into `content_markdown`. The session is freed
     * server-side regardless of success / failure. */
    finalizeAudioSession(sessionId: string, args?: AudioSessionFinalizeRequest): Promise<AudioSessionFinalizeResponse>;
};
//# sourceMappingURL=ai.d.ts.map
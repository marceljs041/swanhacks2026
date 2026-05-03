export interface QuizQueueSnapshot {
    active: {
        id: string;
        label: string;
    } | null;
    pending: Array<{
        id: string;
        label: string;
    }>;
    total: number;
}
export declare function getQuizGenerationQueueState(): QuizQueueSnapshot;
export declare function subscribeQuizGenerationQueue(listener: (snapshot: QuizQueueSnapshot) => void): () => void;
/**
 * Serialize quiz generation work so navigation or tab switches do not
 * interrupt in-flight jobs and concurrent requests are processed in order.
 */
export declare function enqueueQuizGeneration<T>(label: string, run: () => Promise<T>): Promise<T>;
//# sourceMappingURL=quizGenerationQueue.d.ts.map
const queue = [];
const listeners = new Set();
let activeTask = null;
let nextTaskId = 1;
function snapshot() {
    return {
        active: activeTask ? { id: activeTask.id, label: activeTask.label } : null,
        pending: queue.map((task) => ({ id: task.id, label: task.label })),
        total: queue.length + (activeTask ? 1 : 0),
    };
}
function notify() {
    const state = snapshot();
    for (const listener of listeners)
        listener(state);
}
export function getQuizGenerationQueueState() {
    return snapshot();
}
export function subscribeQuizGenerationQueue(listener) {
    listeners.add(listener);
    listener(snapshot());
    return () => {
        listeners.delete(listener);
    };
}
async function drainQueue() {
    if (activeTask)
        return;
    try {
        while (queue.length > 0) {
            const task = queue.shift();
            if (!task)
                continue;
            activeTask = task;
            notify();
            try {
                const result = await task.run();
                task.resolve(result);
            }
            catch (error) {
                task.reject(error);
            }
            finally {
                activeTask = null;
                notify();
            }
        }
    }
    finally {
        activeTask = null;
        notify();
    }
}
/**
 * Serialize quiz generation work so navigation or tab switches do not
 * interrupt in-flight jobs and concurrent requests are processed in order.
 */
export function enqueueQuizGeneration(label, run) {
    return new Promise((resolve, reject) => {
        const id = `quiz-job-${nextTaskId++}`;
        queue.push({
            id,
            label,
            run,
            resolve: resolve,
            reject,
        });
        notify();
        void drainQueue();
    });
}
//# sourceMappingURL=quizGenerationQueue.js.map
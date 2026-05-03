export interface QuizQueueSnapshot {
  active: { id: string; label: string } | null;
  pending: Array<{ id: string; label: string }>;
  total: number;
}

type QuizGenerationTask<T> = {
  id: string;
  label: string;
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const queue: QuizGenerationTask<unknown>[] = [];
const listeners = new Set<(snapshot: QuizQueueSnapshot) => void>();
let activeTask: QuizGenerationTask<unknown> | null = null;
let nextTaskId = 1;

function snapshot(): QuizQueueSnapshot {
  return {
    active: activeTask ? { id: activeTask.id, label: activeTask.label } : null,
    pending: queue.map((task) => ({ id: task.id, label: task.label })),
    total: queue.length + (activeTask ? 1 : 0),
  };
}

function notify(): void {
  const state = snapshot();
  for (const listener of listeners) listener(state);
}

export function getQuizGenerationQueueState(): QuizQueueSnapshot {
  return snapshot();
}

export function subscribeQuizGenerationQueue(
  listener: (snapshot: QuizQueueSnapshot) => void,
): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}

async function drainQueue(): Promise<void> {
  if (activeTask) return;
  try {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) continue;
      activeTask = task;
      notify();
      try {
        const result = await task.run();
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      } finally {
        activeTask = null;
        notify();
      }
    }
  } finally {
    activeTask = null;
    notify();
  }
}

/**
 * Serialize quiz generation work so navigation or tab switches do not
 * interrupt in-flight jobs and concurrent requests are processed in order.
 */
export function enqueueQuizGeneration<T>(
  label: string,
  run: () => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = `quiz-job-${nextTaskId++}`;
    queue.push({
      id,
      label,
      run,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    notify();
    void drainQueue();
  });
}


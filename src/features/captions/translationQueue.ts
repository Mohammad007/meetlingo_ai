/**
 * Serialised, bounded translation job queue.
 *
 * - Exactly one job runs at a time (ML Kit is the bottleneck; serial jobs keep caption order stable).
 * - The backlog is bounded. On overflow the OLDEST pending job is evicted and reported via onDrop so its
 *   segment is saved as 'translation_pending' (retryable) — never silently lost.
 * - Jobs can be cancelled per meeting (e.g. on stop or delete).
 */
export interface TranslationJob {
  segmentId: string;
  meetingId: string;
  english: string;
}

export interface QueueStats {
  pending: number;
  processed: number;
  failed: number;
  dropped: number;
  lastLatencyMs: number | null;
  avgLatencyMs: number | null;
}

export interface TranslationQueueOptions {
  maxBacklog?: number;
  run: (job: TranslationJob) => Promise<void>;
  onDrop?: (job: TranslationJob) => void;
  onError?: (job: TranslationJob, error: unknown) => void;
  now?: () => number;
}

export class TranslationQueue {
  private pending: TranslationJob[] = [];
  private running = false;
  private cancelled = new Set<string>();
  private idleResolvers: (() => void)[] = [];
  private stats: QueueStats = { pending: 0, processed: 0, failed: 0, dropped: 0, lastLatencyMs: null, avgLatencyMs: null };
  private totalLatency = 0;
  private readonly maxBacklog: number;
  private readonly now: () => number;

  constructor(private opts: TranslationQueueOptions) {
    this.maxBacklog = opts.maxBacklog ?? 25;
    this.now = opts.now ?? Date.now;
  }

  enqueue(job: TranslationJob) {
    this.cancelled.delete(job.meetingId);
    if (this.pending.some((j) => j.segmentId === job.segmentId)) return; // de-duplicate
    this.pending.push(job);
    while (this.pending.length > this.maxBacklog) {
      const dropped = this.pending.shift()!;
      this.stats.dropped++;
      this.opts.onDrop?.(dropped);
    }
    this.stats.pending = this.pending.length;
    void this.pump();
  }

  /** Removes pending jobs for a meeting; an in-flight job finishes but its result is ignored by callers. */
  cancelMeeting(meetingId: string) {
    this.cancelled.add(meetingId);
    this.pending = this.pending.filter((j) => j.meetingId !== meetingId);
    this.stats.pending = this.pending.length;
  }

  isCancelled(meetingId: string) {
    return this.cancelled.has(meetingId);
  }

  getStats(): QueueStats {
    return { ...this.stats, pending: this.pending.length };
  }

  /** Resolves when the queue is empty and idle. */
  drain(): Promise<void> {
    if (!this.running && this.pending.length === 0) return Promise.resolve();
    return new Promise((r) => this.idleResolvers.push(r));
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length) {
        const job = this.pending.shift()!;
        this.stats.pending = this.pending.length;
        if (this.cancelled.has(job.meetingId)) continue;
        const t0 = this.now();
        try {
          await this.opts.run(job);
          this.stats.processed++;
          const dt = this.now() - t0;
          this.stats.lastLatencyMs = dt;
          this.totalLatency += dt;
          this.stats.avgLatencyMs = Math.round(this.totalLatency / this.stats.processed);
        } catch (e) {
          this.stats.failed++;
          this.opts.onError?.(job, e);
        }
      }
    } finally {
      this.running = false;
      const resolvers = this.idleResolvers;
      this.idleResolvers = [];
      resolvers.forEach((r) => r());
    }
  }
}

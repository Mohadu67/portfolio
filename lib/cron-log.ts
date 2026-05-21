import { CronLog, type CronJobName, type CronStatus, type ICronLog } from "@/models/CronLog";

const MAX_LOGS_PER_JOB = 200;

interface RecordCronRunInput {
  name: CronJobName;
  startedAt: Date;
  status: CronStatus;
  processed?: number;
  succeeded?: number;
  failed?: number;
  error?: string | null;
  summary?: string | null;
}

/**
 * Persiste une exécution de cron + trim l'historique (garde les 200 derniers
 * par job pour éviter la croissance illimitée de la collection).
 * Fire-and-forget côté caller : ne throw pas, log juste en console.
 */
export async function recordCronRun(input: RecordCronRunInput): Promise<void> {
  try {
    const log: Partial<ICronLog> = {
      name: input.name,
      ranAt: input.startedAt,
      durationMs: Date.now() - input.startedAt.getTime(),
      status: input.status,
      processed: input.processed ?? 0,
      succeeded: input.succeeded ?? 0,
      failed: input.failed ?? 0,
      error: input.error ?? null,
      summary: input.summary ?? null,
    };
    await CronLog.create(log);

    // Trim oldest logs for this job beyond MAX_LOGS_PER_JOB
    const count = await CronLog.countDocuments({ name: input.name });
    if (count > MAX_LOGS_PER_JOB) {
      const toDelete = await CronLog.find({ name: input.name })
        .sort({ ranAt: 1 })
        .limit(count - MAX_LOGS_PER_JOB)
        .select("_id")
        .lean<{ _id: unknown }[]>();
      if (toDelete.length > 0) {
        await CronLog.deleteMany({ _id: { $in: toDelete.map((d) => d._id) } });
      }
    }
  } catch (err) {
    console.error("[cron-log] failed to record run:", err instanceof Error ? err.message : err);
  }
}

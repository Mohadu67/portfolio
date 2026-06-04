import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CronLog, type ICronLog } from "@/models/CronLog";
import { verifyAuth } from "@/lib/auth";

const JOB_NAMES = [
  "run-relances",
  "check-inbox",
  "run-saved-queries",
  "weekly-prospect",
  "run-offer-search",
  "process-pending",
] as const;

interface JobStatus {
  name: (typeof JOB_NAMES)[number];
  lastRunAt: string | null;
  lastStatus: "success" | "failed" | "skipped" | null;
  lastDurationMs: number | null;
  lastError: string | null;
  lastSummary: string | null;
  staleSinceMinutes: number | null;
  recentFailures: number;
}

const STALENESS_THRESHOLD_MINUTES: Record<JobStatus["name"], number> = {
  "run-relances": 30,
  "check-inbox": 60,
  "run-saved-queries": 720, // 12h
  "weekly-prospect": 10260, // 7j + ~3h de marge
  "run-offer-search": 10260, // hebdo (lundi 9h05) + marge
  "process-pending": 1500, // quotidien (25h)
};

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const now = Date.now();

  const jobs: JobStatus[] = [];
  for (const name of JOB_NAMES) {
    const last = await CronLog.findOne({ name }).sort({ ranAt: -1 }).lean<ICronLog | null>();
    const recentFailures = await CronLog.countDocuments({
      name,
      status: "failed",
      ranAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
    });

    const lastRunMs = last?.ranAt ? new Date(last.ranAt).getTime() : null;
    const minutesSince = lastRunMs ? Math.floor((now - lastRunMs) / 60000) : null;
    const threshold = STALENESS_THRESHOLD_MINUTES[name];
    const staleSinceMinutes =
      minutesSince !== null && minutesSince > threshold ? minutesSince : null;

    jobs.push({
      name,
      lastRunAt: last?.ranAt ? new Date(last.ranAt).toISOString() : null,
      lastStatus: last?.status ?? null,
      lastDurationMs: last?.durationMs ?? null,
      lastError: last?.error ?? null,
      lastSummary: last?.summary ?? null,
      staleSinceMinutes,
      recentFailures,
    });
  }

  const healthy = jobs.every(
    (j) => j.lastStatus !== "failed" && j.staleSinceMinutes === null
  );

  return NextResponse.json({ healthy, jobs });
}

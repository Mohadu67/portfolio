import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature, ICandidature, IRelanceLog } from "@/models/Candidature";
import { sendRelance } from "@/lib/email";
import { sendNotification } from "@/lib/notifications";
import { recordCronRun } from "@/lib/cron-log";

// Cron endpoint: runs all due relances.
//
// Auth: Authorization: Bearer $CRON_SECRET (separate from API_SECRET)
//
// Schedule on VPS via crontab (every 15 min):
//   *‍/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/run-relances >/dev/null
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  try {
    await connectDB();
    const now = startedAt;

    // Ceinture+bretelles : ne renvoyer une relance QUE si la candidature est encore "postulée".
    // Si le statut a bougé (réponse reçue, refus, entretien, acceptée) la relance n'a plus lieu d'être,
    // même si une annulation explicite a foiré quelque part dans le pipeline.
    const due = await Candidature.find({
      statut: "postulée",
      "relanceHistory.status": "programmée",
      "relanceHistory.scheduledFor": { $lte: now },
      email: { $ne: "" },
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ candidature: string; error: string }> = [];

    for (const candidature of due as ICandidature[]) {
      const history = candidature.relanceHistory ?? [];
      for (let i = 0; i < history.length; i++) {
        const entry = history[i];
        if (entry.status !== "programmée" || !entry.scheduledFor) continue;
        if (new Date(entry.scheduledFor).getTime() > now.getTime()) continue;
        if (!candidature.email) {
          entry.status = "échouée";
          entry.error = "Email destinataire manquant";
          failed++;
          continue;
        }

        processed++;
        try {
          await sendRelance(
            candidature.entreprise,
            candidature.poste,
            candidature.email,
            entry.message,
            entry.templateTitle ?? "Relance",
            candidature.type ?? "alternance",
            process.env.PROFIL_NOM ?? "Mohammed Hamiani"
          );
          entry.status = "envoyée";
          entry.sentAt = now;

          candidature.emailsSent = [
            ...(candidature.emailsSent ?? []),
            {
              date: now,
              to: candidature.email,
              subject: `${entry.templateTitle ?? "Relance"} - ${candidature.poste}`,
              type: "relance",
              status: "sent",
              error: null,
            },
          ];

          sendNotification({
            type: "relance",
            candidature: {
              _id: String(candidature._id),
              entreprise: candidature.entreprise,
              poste: candidature.poste,
              email: candidature.email,
            },
            emailSubject: `${entry.templateTitle ?? "Relance"} - ${candidature.poste}`,
          }).catch(() => {});

          succeeded++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          entry.status = "échouée";
          entry.error = msg;
          candidature.emailsSent = [
            ...(candidature.emailsSent ?? []),
            {
              date: now,
              to: candidature.email,
              subject: `${entry.templateTitle ?? "Relance"} - ${candidature.poste}`,
              type: "relance",
              status: "failed",
              error: msg,
            },
          ];
          failed++;
          errors.push({ candidature: String(candidature._id), error: msg });
        }
      }
      await (candidature as unknown as { save: () => Promise<unknown> }).save();
    }

    await recordCronRun({
      name: "run-relances",
      startedAt,
      status: failed > 0 ? "failed" : "success",
      processed,
      succeeded,
      failed,
      summary: `${succeeded}/${processed} relances envoyées`,
    });

    return NextResponse.json({
      ok: true,
      ranAt: now.toISOString(),
      processed,
      succeeded,
      failed,
      errors,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[cron run-relances]", msg);
    await recordCronRun({
      name: "run-relances",
      startedAt,
      status: "failed",
      error: msg,
    });
    return NextResponse.json({ error: "Cron failed", details: msg }, { status: 500 });
  }
}

// GET for health-check / dry-run preview (lists due relances without sending)
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const now = new Date();
  const due = await Candidature.find({
    "relanceHistory.status": "programmée",
    "relanceHistory.scheduledFor": { $lte: now },
  })
    .select("entreprise poste email relanceHistory")
    .lean<ICandidature[]>();

  const items = due.flatMap((c) =>
    (c.relanceHistory ?? [])
      .filter(
        (r: IRelanceLog) =>
          r.status === "programmée" && r.scheduledFor && new Date(r.scheduledFor).getTime() <= now.getTime()
      )
      .map((r: IRelanceLog) => ({
        candidatureId: String(c._id),
        entreprise: c.entreprise,
        poste: c.poste,
        email: c.email,
        scheduledFor: r.scheduledFor,
        templateTitle: r.templateTitle,
      }))
  );

  return NextResponse.json({ ranAt: now.toISOString(), dueCount: items.length, items });
}

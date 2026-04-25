import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { scheduledFor, template, templateTitle, message } = body;

    if (!scheduledFor || !message) {
      return NextResponse.json({ error: "scheduledFor and message are required" }, { status: 400 });
    }

    await connectDB();
    const candidature = await Candidature.findById(id);
    if (!candidature) return NextResponse.json({ error: "Not found" }, { status: 404 });

    candidature.relanceHistory = [
      ...(candidature.relanceHistory ?? []),
      {
        scheduledFor: new Date(scheduledFor),
        template: template ?? "initial",
        templateTitle: templateTitle ?? "Relance",
        message,
        status: "programmée",
      },
    ];
    await candidature.save();

    return NextResponse.json(candidature, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST relance]", msg);
    return NextResponse.json({ error: "Failed to schedule relance", details: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { index, action, scheduledFor, message, templateTitle } = body as {
      index: number;
      action?: "cancel" | "duplicate";
      scheduledFor?: string;
      message?: string;
      templateTitle?: string;
    };

    if (typeof index !== "number") {
      return NextResponse.json({ error: "index required" }, { status: 400 });
    }

    await connectDB();
    const candidature = await Candidature.findById(id);
    if (!candidature) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const entry = candidature.relanceHistory?.[index];
    if (!entry) return NextResponse.json({ error: "Relance entry not found" }, { status: 404 });

    if (action === "cancel") {
      entry.status = "annulée";
    } else if (action === "duplicate") {
      const baseDate = new Date(entry.scheduledFor);
      const newDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      candidature.relanceHistory.push({
        scheduledFor: newDate,
        template: entry.template ?? "custom",
        templateTitle: entry.templateTitle,
        message: entry.message,
        status: "programmée",
      });
    } else {
      if (entry.status !== "programmée") {
        return NextResponse.json({ error: "Can only edit programmée relances" }, { status: 400 });
      }
      if (scheduledFor) entry.scheduledFor = new Date(scheduledFor);
      if (typeof message === "string") entry.message = message;
      if (typeof templateTitle === "string") entry.templateTitle = templateTitle;
    }

    await candidature.save();
    return NextResponse.json(candidature);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PATCH relance]", msg);
    return NextResponse.json({ error: "Failed to update relance", details: msg }, { status: 500 });
  }
}

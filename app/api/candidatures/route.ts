import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { entreprise, poste, plateforme, localisation, url, description, email, aboutText, statut, date } = body;

    if (!entreprise || !url) {
      return NextResponse.json(
        { error: "entreprise and url are required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Check for duplicate
    const existing = await Candidature.findOne({ url });
    if (existing) {
      return NextResponse.json(
        { error: "Une candidature avec cette URL existe déjà", details: "duplicate" },
        { status: 409 }
      );
    }

    const candidature = await Candidature.create({
      entreprise,
      poste: poste || "Candidature spontanée",
      plateforme: plateforme || "Web",
      localisation: localisation || "",
      url,
      description: (description || "").substring(0, 500),
      email: email || "",
      aboutText: aboutText || "",
      statut: statut || "identifiée",
      lettre: null,
      cv: null,
      notes: "",
      date: date || new Date().toISOString().split("T")[0],
    });

    return NextResponse.json(candidature, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating candidature:", errorMessage);
    return NextResponse.json(
      { error: "Failed to create candidature", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const candidatures = await Candidature.find().sort({ created_at: -1 });

    const stats = candidatures.reduce(
      (acc, c) => {
        acc[c.statut] = (acc[c.statut] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      candidatures,
      stats,
      total: candidatures.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching candidatures:", errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch candidatures", details: errorMessage },
      { status: 500 }
    );
  }
}

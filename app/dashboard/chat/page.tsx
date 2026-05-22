"use client";

import { useApiKey } from "@/lib/contexts/AuthContext";
import { ChatPanel } from "@/components/dashboard/chat/ChatPanel";

// Variant page : pleine page sur mobile, max-w-3xl centré sur desktop.
// La ChatPanel gère elle-même le contraint de largeur en interne pour
// que le header + l'input collent aux bords sur mobile mais que le
// contenu reste lisible sur grand écran.
export default function ChatFullPage() {
  const apiKey = useApiKey();

  return (
    <div className="w-full h-full">
      <ChatPanel apiKey={apiKey} variant="page" />
    </div>
  );
}

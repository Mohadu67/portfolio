// Types partagés par les sous-composants du chat dashboard.

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  requires_confirmation?: boolean;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ToolCallState {
  call: ToolCall;
  // Input édité par l'utilisateur dans la card avant approbation
  // (override de call.input à l'exec).
  editedInput?: Record<string, unknown>;
  status: "pending" | "approved" | "executing" | "done" | "rejected" | "error";
  result?: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
}

export const STORAGE_KEY = "chat-messages-v2";

export const TOOL_LABELS: Record<string, string> = {
  schedule_relance: "Programmer une relance",
  cancel_relance: "Annuler une relance",
  update_candidature_status: "Changer le statut",
  update_candidature_notes: "Mettre à jour les notes",
  send_relance_now: "Envoyer une relance immédiatement",
  list_candidatures: "Lister les candidatures",
  get_candidature: "Lire une candidature",
  list_relances_due: "Lister les relances dues",
  list_cv_sections: "Lister les sections du CV",
  get_cv_section: "Lire une section du CV",
  apply_to_company: "Envoyer une candidature à une entreprise",
};

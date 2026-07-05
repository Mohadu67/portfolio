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
  // Boutons d'action contextuels affichés sous le message assistant qui suit ce tool result.
  // Click sur un chip → exécute le tool avec l'input fourni, sans repasser par la card de confirmation.
  // Le contenu vient du backend (tool-exec response), n'est PAS renvoyé à l'IA dans tool_results.
  actions?: ToolAction[];
}

export interface ToolAction {
  // ID stable pour key React + tracking d'exécution
  id: string;
  // Label visible (court, ex : "Envoyer à contact@boite.com")
  label: string;
  // Tool à exécuter au click
  tool: string;
  // Input du tool
  input: Record<string, unknown>;
  // Style visuel : primary (action principale), secondary (alternative), danger (abandon)
  variant?: "primary" | "secondary" | "danger";
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
  search_offers: "Chercher des offres sur les job boards",
  get_lettre: "Lire la lettre de motivation",
  get_stats: "Statistiques du pipeline",
  list_reminders: "Lister les rappels programmés",
  cancel_reminder: "Annuler un rappel",
  list_blacklist: "Lister les domaines écartés",
  unblacklist_domain: "Réactiver un domaine écarté",
  create_candidature: "Créer une candidature (sans envoi)",
  delete_candidature: "Supprimer définitivement une candidature",
  write_letter: "Régénérer la lettre avec consigne",
  set_lettre: "Enregistrer une lettre sur mesure",
};

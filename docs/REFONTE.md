# 🎯 Refonte « Dashboard de guerre »

> Document de suivi de la grande refonte UI/UX + features.
> Démarré le **2026-04-25**.

---

## Vision

Un cockpit unique où :
- On décide en 5 secondes ce qu'il faut faire aujourd'hui (war room).
- L'IA **agit** (tool use avec confirmation), pas juste discute.
- Tout est éditable depuis le navigateur (CV, photo, médias, templates).
- Les relances sont totalement personnalisables (annuler, dupliquer, replanifier, message libre).

## Décisions verrouillées

| # | Décision |
|---|---|
| 1 | Layout = **sidebar fixe rétractable** (240/64px) + topbar contextuelle + dock IA droit (Cmd+K) |
| 2 | Modèle Claude chat = **Opus 4.7 (1M cache)** par défaut, toggle Sonnet possible plus tard |
| 3 | Tool use IA = **confirmation pour mutatifs, auto pour read-only** |
| 4 | Preview CV = **React inline** (split-screen, pas d'iframe) |
| 5 | Auto-génération lettres à la création = **OFF par défaut**, opt-in dans settings |
| 6 | Chat dock = **opt-in via Cmd+K**, fermé par défaut |
| 7 | Versioning CV = **reporté en Lot 5** (skip pour l'instant) |
| 8 | Templates relances = **hybride** : édition libre par défaut + raccourcis 1-clic |
| 9 | `FollowUpModal`, `CompanySearchPanel` géants = **réécrits, anciens supprimés** |

## Architecture cible (routes)

```
/dashboard               → War Room
/dashboard/candidatures  → Pipeline (kanban + table)
/dashboard/candidatures/[id] → Vue 360°
/dashboard/recherche     → Offres + Entreprises unifiés
/dashboard/relances      → Calendrier / Timeline / Par candidature
/dashboard/cv            → Builder split-screen avec preview live
/dashboard/media         → 🆕 Photo portfolio + CVs PDF + assets projets
/dashboard/chat          → IA agentique full-page
/dashboard/settings      → Profil, clés API, templates, prompts IA
```

## Plan de chantier

| Lot | Contenu | Statut | Commit |
|---|---|---|---|
| **0** | Shell : sidebar/topbar/dock, AuthGuard, useAuth, tokens CSS étendus | ✅ Livré | `3eb33b6` |
| **1** | Refonte relances : composer libre, tabs Timeline/Par candidature, actions per-relance, RelanceTemplate | ✅ Livré | (en cours) |
| **2** | War Room : home refondue, endpoint summary, agenda actif, alertes calculées | ✅ Livré | (en cours) |
| **3** | Media Manager (photo portfolio uploadable + CVs unifiés). Vue 360 candidature reportée. | ✅ Livré | (en cours) |
| **4** | Chat IA streaming (Anthropic Opus 4.5, prompt cache, contexte complet). Tool use reporté. | ✅ Livré (MVP) | (en cours) |
| **5** | Settings : templates relances éditables, état config. Automations reportées. | ✅ Livré (partiel) | (en cours) |

Légende : ⏳ pending · 🟡 en cours · ✅ livré · ⚠️ bloqué

## Conventions

- **Branche** : `main` (déploiement auto via GitHub Actions sur push).
- **Build** : validé via `docker build` local avant chaque push.
- **Commits** : `feat: …`, `fix: …`, `chore: …` en français, sans mention Claude.
- **Doc** : ce fichier mis à jour à chaque lot terminé (commit + statut).

## Notes de session

### 2026-04-25 — Lot 0 livré

**Livré :**
- `app/dashboard/layout.tsx` — shell partagé via `<AuthGuard>` (Context-based, plus de render-prop pour compat SSG) + `<DashboardShell>`.
- `components/dashboard/shell/{Sidebar,Topbar,ChatDock,MobileNav,DashboardShell,AuthGuard}.tsx` — sidebar fixe rétractable (état persisté localStorage), topbar contextuelle avec titre auto, dock chat IA placeholder (Cmd+K), drawer mobile.
- `lib/hooks/useAuth.ts` — auth centralisée (sessionStorage api-key).
- `lib/contexts/AuthContext.tsx` — `<AuthProvider>` + `useApiKey()` hook (consommé par toutes les pages enfants).
- `app/globals.css` — nouveaux tokens : `--bg-hover`, `--bg-active`, `--accent-danger/warning/success/info/violet`, sizing sidebar/topbar.
- Migration de toutes les pages dashboard existantes : suppression des headers et logins individuels (`page.tsx`, `cv/`, `relances/`, `cv-files/`).
- Nouvelle organisation : la liste des candidatures est passée à `/dashboard/candidatures` (le `/dashboard` devient le futur War Room — pour l'instant : tableau de bord avec liens et stats globales).
- Stubs pour les nouvelles routes : `/dashboard/recherche`, `/media`, `/chat`, `/settings` (placeholders informatifs).

**Validation :** `docker build` OK localement, push à venir → CI/CD.

### 2026-04-25 — Lots 1 → 5 livrés en burst

**Lot 1 — Refonte relances**
- `RelanceComposer` : panneau slide-in 560px, édition libre + variables `{entreprise} {poste} {type} {prenom}`, datepicker natif + presets J+7/14/21/+1mois, templates en raccourci 1-clic (insertion, pas contrainte), preview avec substitution.
- `app/dashboard/relances/page.tsx` refonte complète : tabs Timeline / Par candidature, actions per-relance (Envoyer maintenant, Modifier, Dupliquer +7j, Annuler), bouton "Nouvelle relance" avec picker de candidature.
- Modèle `RelanceTemplate` + endpoints `/api/relance-templates` (CRUD) + 3 templates built-in seedés au premier appel.
- `PATCH /api/candidatures/[id]/relances` étendu avec `action: "duplicate"` et édition de `templateTitle`.
- Suppression de `FollowUpModal` côté usage (remplacé par `RelanceComposer` dans la page candidatures).

**Lot 2 — War Room**
- `GET /api/dashboard/summary` : alertes (relances en retard / aujourd'hui, candidatures stagnantes >7j, entretiens), agenda du jour, à venir 7j, métriques 7j (candidatures, emails, taux réponse), recent activity.
- `app/dashboard/page.tsx` : bandeau alertes coloré, agenda cliquable (en retard + aujourd'hui), métriques, mini-pipeline 7 statuts cliquables, stagnantes, dernière activité, quick actions.

**Lot 3 — Media Manager**
- Modèle `MediaAsset` (Buffer + kind = photo|project|asset, isActive flag).
- API `/api/media` (GET/POST), `/api/media/[id]` (GET public, PATCH, DELETE), `/api/media/[id]/use-as-photo` (set as portfolio photo + update `CVSection.profile.photo` à `/api/media/[id]`).
- `app/dashboard/media/page.tsx` : grille de photos, drag-and-drop, badge "Active", actions hover (preview, set as photo, delete), liste courte des CVs avec lien vers `/dashboard/cv-files`.
- Photo de profil : sélection d'un click → met à jour la section `profile` de la DB → portfolio public refléchit (cache ISR 60s).

**Lot 4 — Chat IA (MVP)**
- `lib/ai/context.ts` : assemble contexte complet (profil + sections CV + candidatures + relances + emails) en JSON compact.
- `app/api/chat/route.ts` : streaming SSE, Anthropic SDK, modèle Opus 4.5 (configurable via `CHAT_MODEL`), prompt caching ephemeral sur le bloc contexte, system prompt français exigeant et factuel.
- `components/dashboard/chat/ChatPanel.tsx` : UI partagée (dock + page), messages persistés en sessionStorage, suggestions de prompts au démarrage, streaming live avec curseur, raccourci Enter (Shift+Enter pour nouvelle ligne), bouton effacer.
- `ChatDock` activé (avant placeholder).
- `/dashboard/chat` plein écran utilise le même panel.
- Tool use reporté (le user peut demander conseil mais l'IA ne peut pas encore agir).

**Lot 5 — Settings (partiel)**
- `app/dashboard/settings/page.tsx` : éditeur de templates de relance complet (créer / modifier / supprimer, avec garde-fou builtin), état de la config serveur (sans révéler les secrets), liens vers CV/Médias.
- Automations (auto-discover email, daily digest, auto-brouillon) reportées — le shell est en place pour les ajouter facilement.

**Validation :** `docker build` OK. Build complet, type-check passé.

### 2026-04-25 — Tool use IA + Vue 360 + déploiement VPS

- **Tool use IA** : `lib/ai/tools.ts` (5 tools : `schedule_relance`, `cancel_relance`, `update_candidature_status`, `update_candidature_notes`, `send_relance_now`). Endpoint `/api/chat/tool-exec` qui exécute les tools côté serveur. Streaming `/api/chat` enrichi pour intercepter `tool_use` et les renvoyer via SSE. UI `ChatPanel` refondue : carte de confirmation pour chaque tool call, exécution séquentielle, renvoi des résultats à l'IA pour suite. Persistence sessionStorage v2 (avec tool_calls).
- **Vue 360 candidature** : `app/dashboard/candidatures/[id]/page.tsx` plein écran : header (entreprise, poste, statut, badges, switcher de statut), 2 colonnes (lettre versionnée, description, notes inline éditables, historique emails | actions, relances avec actions per-relance + composer slide-in).
- **Déploiement VPS** : VPS mis à jour (commits 0→5 + tool use). `docker-compose.yml` working preservé (volumes existants), Dockerfile du repo (Node 22 + lazy env) accepté. Nouveau workflow GitHub Actions qui fait `git pull` proprement avec stash/restore du compose VPS-spécifique.

### 2026-04-26 — Audit qualité portfolio public

Audit exhaustif du portfolio public (page d'accueil + 7 sections + atoms/molecules/NavBar). 27 défauts catalogués, fixés par sévérité.

**🔴 Critiques**
- `app/layout.tsx` : metadata étendu avec OpenGraph + Twitter card + robots, `metadataBase`, `title.template` pour SEO. Photo `/photoCV.png` exposée comme image OG.
- `FooterSection` : année hardcodée → `new Date().getFullYear()`.
- `HeroSection` : retrait du doublon "Fullstack Developer" hardcodé (utilise `profile.title`), particles 20 → 12, `h-screen` → `min-h-screen` + paddings mobiles, alt enrichi `Portrait de ${name}, ${title}`, headings adoucis sur mobile (`text-3xl sm:text-4xl md:text-6xl lg:text-7xl`).
- `EducationSection` / `ExperienceSection` : modals figés à `h-96` → `min-h-[20rem] max-h-[85vh]` avec scroll interne propre. Animation `Lightbulb`/`Briefcase` infinie supprimée. Double `onClick` retiré (un seul wrapper `<button>` accessible). Suppression de la timeline `md:ml-auto md:mr-0` alternée qui cassait la symétrie.
- `SkillCard` : animation infinie `🐛 rotate` retirée (CPU + distrayante).

**🟠 Important**
- `Section` molecule : padding harmonisé `py-16 md:py-20 lg:py-24` (au lieu de `py-20` figé qui jurait avec le hero `min-h-screen`).
- `ContactSection` : padding aligné sur Section, gap header normalisé.
- `ProjectsSection` : IIFE `(() => {...})()` confuse → conditional render simple `{selectedProject && currentProject?.credentials && (...)}`. Modal a maintenant `role="dialog" aria-modal="true" aria-labelledby` propre.
- `ProjectCard` : `width=200 + scale-50` (anti-pattern qui force le browser à scaler) → `width=120 height=120 object-contain`. Alt enrichi.
- `NavBar` : `aria-label` partout, `aria-current="page"` sur le bouton actif, `aria-expanded` sur le menu radial, `focus-visible:ring` sur tous les boutons. Type `MenuItem` corrigé pour inclure `label`.

**🟡 Polish**
- `globals.css` : 7 keyframes inutilisées supprimées (gardé seulement `gradient-shift` qui sert dans le hero), ajout du media query `prefers-reduced-motion: reduce` pour respecter les préférences système.
- `HeroSection` imports nettoyés (`Code2`, `Button`, `slideUpItem` retirés).

Validations : `docker build` OK, lint TypeScript clean.

**Notifications (envoi mail à soi-même)**
- `lib/notifications.ts` : `sendNotification({ type, candidature, ... })` envoie un email HTML stylé à `GMAIL_USER` (= soi-même) à chaque action. Vérifie les préférences dans Settings avant d'envoyer.
- Branché sur : `/api/send-email` (candidature), `/api/send-relance` (manuelle), `/api/cron/run-relances` (cron), et le sync IMAP (réponse reçue).
- Toggle ON/OFF par type dans `/dashboard/settings`.

**Gmail IMAP — détection des réponses**
- Deps : `imapflow` + `mailparser`.
- `lib/gmail-imap.ts` : `syncGmailInbox()` se connecte à `imap.gmail.com:993` avec `GMAIL_APP_PASSWORD`, scanne les messages non lus des 30 derniers jours, matche par `From:` avec `candidature.email` (exact, case-insensitive).
- Pour chaque match : ajoute à `candidature.emailsReceived[]` (date, from, subject, snippet, messageId, archived), passe le statut à `réponse reçue` si actuellement `postulée`, dédoublonne par `messageId`.
- Si `gmail.autoArchiveResponses=true` : déplace l'email vers le label Gmail `Cockpit/Réponses candidatures` (le crée si absent).
- Endpoint `POST /api/cron/check-inbox` (auth Bearer CRON_SECRET) : à brancher sur crontab toutes les 30 min. Skip si `gmail.inboxSyncEnabled=false`.
- Endpoint `POST /api/inbox/sync` (auth API key) : déclenchement manuel depuis l'UI, avec mode `?dryRun=1`.
- Modèle `Settings` créé : `notifications.{onCandidatureSent,onRelanceSent,onInboxResponse}` + `gmail.{inboxSyncEnabled,autoArchiveResponses,lastSyncAt,lastSyncSummary}`.
- API `/api/settings` GET/PATCH.
- UI `/dashboard/settings` refondue : toggles propres pour chaque option, bouton « Synchroniser maintenant » + dry-run, dernière sync affichée, résumé des matchs.
- Schéma `Candidature` : `emailsReceived[]` ajouté + index sur `email` et `emailsReceived.messageId`.

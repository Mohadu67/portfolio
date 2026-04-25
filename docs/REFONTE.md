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
| **0** | Shell : sidebar/topbar/dock, AuthGuard, useAuth, tokens CSS étendus | ✅ Livré | (push à venir) |
| **1** | Refonte relances : composer libre, tabs Cal/Timeline, actions per-relance, RelanceTemplate | ⏳ Pending | – |
| **2** | War Room : home refondue, endpoint summary, agenda actif, kanban mini, alertes | ⏳ Pending | – |
| **3** | Vue 360 candidature + Media Manager (photo + CVs unifiés) | ⏳ Pending | – |
| **4** | Chat IA agentique : streaming SSE, tool use, conversations persistées, dock + full | ⏳ Pending | – |
| **5** | Automations + Settings + polish (auto-discover email, daily digest, raccourcis clavier, onboarding) | ⏳ Pending | – |

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

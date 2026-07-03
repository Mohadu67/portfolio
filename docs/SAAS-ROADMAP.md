# 🚀 Roadmap — Transformation en SaaS public

> Passage de l'app perso mono-utilisateur (« machine de guerre ») à un **SaaS multi-tenant public**.
> Cible verrouillée : SaaS public · Fondations d'abord · Plan validé avant code.
> Démarré le **2026-06-23**.

---

## 0. Cible & principes

**Vision produit.** Chacun s'inscrit, connecte SON Gmail, importe SON CV, et obtient sa propre « machine de guerre » : prospection + lettres IA + envoi + suivi des réponses + portfolio public personnel.

**Principes directeurs :**
1. **Isolation stricte des données** — aucune requête DB sans `userId`. Un test prouve que l'utilisateur A ne voit jamais les données de B.
2. **Secrets par utilisateur chiffrés au repos** (tokens Gmail OAuth, clé IA optionnelle).
3. **Coûts maîtrisés** — les APIs payantes plateforme (IA, SerpAPI, RapidAPI) sont quotaisées par utilisateur.
4. **Livraison par lots** — chaque lot compile (`docker build`), passe le type-check, et est déployable.
5. **Fondations avant cosmétique** — on ne refait pas le design deux fois.

---

## 1. Décisions d'architecture (recommandations)

| # | Sujet | Recommandation | Alternatives / notes |
|---|---|---|---|
| A1 | **Lib d'auth** | **Auth.js v5 (next-auth@5)** + MongoDB adapter. Self-hosted, gratuit, intègre Google OAuth. | Clerk (managé, plus cher, moins de contrôle) ; Lucia (plus bas niveau). |
| A2 | **Méthodes de connexion** | **Google OAuth** (principal) + **email/mot de passe**. Le même Google OAuth servira aussi à l'accès Gmail. | Magic link possible plus tard. |
| A3 | **Accès Gmail** | **Gmail API via OAuth** (scopes `gmail.send` + `gmail.readonly`/`modify`). Remplace SMTP nodemailer + IMAP app-password. | ⚠️ Scopes « restreints » → **vérification Google obligatoire** au-delà de 100 users (voir §Risques). |
| A4 | **Clés IA (Gemini)** | **Hybride** : clé plateforme partagée avec **quota par plan** (gratuit limité) + option **BYOK** (l'user colle sa clé, illimité). | Tout-plateforme = tu payes tout ; tout-BYOK = friction onboarding. |
| A5 | **APIs offres** (SerpAPI/RapidAPI/Adzuna/FT) | **Plateforme**, partagées, **métrées + quota par user**. | Trop cher/complexe en BYOK pour chacune. |
| A6 | **Stockage binaire** (CV PDF, photos) | **Object storage** (Cloudflare R2 / S3) + URLs présignées. Aujourd'hui en `Buffer` Mongo → ne scale pas. | Migration en Phase 4 (pas bloquant au début). |
| A7 | **Portfolio public** | **Par-utilisateur** sur `/{username}` (ou `/p/{slug}`). La racine `/` devient la **landing marketing** du SaaS. | Sous-domaine `user.app.com` plus tard (DNS wildcard). |
| A8 | **Settings** | Passe de **singleton global** à **un doc par user**. | — |
| A9 | **Jobs / crons** | Endpoints cron qui **bouclent sur les users éligibles**, quota Gmail par compte. Redis+BullMQ quand le nombre d'users grossit. | Crontab actuel suffit pour la beta. |
| A10 | **Chiffrement secrets** | **AES-256-GCM**, clé maître `ENCRYPTION_KEY` (env). | KMS managé plus tard. |
| A11 | **Design system** | **shadcn/ui (Radix) sur Tailwind v4** — accessibilité native (indispensable en public), tue le pattern modal réimplémenté 11×. | Réveiller les `atoms/` morts = moins d'a11y, plus de boulot. |
| A12 | **Nom / marque** | À choisir (actuellement `portfolio-temp` / « Cockpit »). | Décision produit ouverte. |

---

## PHASE 1 — Fondations (multi-tenant, auth, secrets, cleanup)

> La phase la plus risquée et la plus à forte valeur. Rien de visuel ici.

### Lot 1.1 — Auth réelle (Auth.js v5)
- Installer `next-auth@5` + `@auth/mongodb-adapter`.
- Providers : Google OAuth + Credentials (email/mot de passe, hash `argon2`/`bcrypt`).
- Modèles gérés par l'adapter : `User`, `Account`, `Session`, `VerificationToken`. Ajouter au `User` : `username` (slug portfolio), `plan`, `createdAt`.
- `middleware.ts` : protège `/dashboard/*` et `/api/*` (sauf routes publiques + cron).
- Remplacer `verifyAuth(x-api-key)` dans **35 routes** par `const session = await auth()` → 401 si absent, `userId = session.user.id`.
- **Supprimer** : `lib/auth.ts` (x-api-key), `lib/hooks/useAuth.ts`, `lib/contexts/AuthContext.tsx`, `components/dashboard/shell/AuthGuard.tsx` (LoginScreen sessionStorage), `components/dashboard/LoginForm.tsx`.
- Les crons gardent `CRON_SECRET` (machine-to-machine).
- Plus besoin de recopier `x-api-key` à la main : les cookies de session partent tout seuls.

### Lot 1.2 — Modèle de données multi-tenant
- Ajouter `userId: ObjectId (ref User, index)` à : `Candidature`, `CVFile`, `CVSection`, `MediaAsset`, `Note`, `ProspectedDomain`, `RelanceTemplate`, `SavedQuery`, `SavedSearch`, `Settings`, `CronLog`.
- Index uniques → **composés avec userId** : `Candidature {userId, url}`, `CVSection {userId, key}`, `SavedQuery {userId, keywords, location}`, `SavedSearch {userId, url}`.
- `getSettings()` → `getSettings(userId)` (plus de singleton).
- **Script de migration** : créer le `User` de Mohammed, réassigner tous les docs existants à son `userId`, backfill `Settings` depuis le singleton + les `PROFIL_*` de l'env.

### Lot 1.3 — Scoping de toutes les routes & lib (le grand balayage)
- Chaque route API : dériver `userId` de la session, scoper **toutes** les requêtes.
- Chaque fonction lib qui touche la DB reçoit `userId` : `auto-apply`, `offer-search`, `pending-processor`, `gmail-imap`, `notifications`, `cv`, `dashboard/summary`, `ai/context`, `ai/tools` (les 13 tools).
- Candidat idéal pour un **workflow multi-agent** (un fichier par agent) vu le volume mécanique.

### Lot 1.4 — Intégrations par utilisateur + secrets chiffrés
- `lib/crypto.ts` : `encrypt()/decrypt()` AES-256-GCM (clé `ENCRYPTION_KEY`).
- Modèle `UserIntegration` (ou champs sur `User`) : tokens Gmail OAuth **chiffrés**, clé IA BYOK **chiffrée** (optionnelle), compteurs d'usage (emails 24h, IA, recherches).
- **Réécrire `lib/email.ts`** : Gmail API (`googleapis`) avec token OAuth par user au lieu de SMTP global.
- **Réécrire `lib/gmail-imap.ts`** : lecture des réponses via Gmail API (`gmail.readonly`) au lieu d'IMAP app-password.
- **`lib/gemini.ts`** : clé par user (plateforme ou BYOK) au lieu de `process.env.GEMINI_API_KEY`.
- APIs offres : restent en env plateforme, mais **métrage + quota** par user avant chaque appel.

### Lot 1.5 — Crons multi-tenant
- Chaque endpoint cron boucle sur les users éligibles (`autoApplyEnabled` + token Gmail valide), exécute le pipeline avec **leur** Settings + **leur** quota.
- `CronLog` scopé par user. Verrou de concurrence par user.

### Lot 1.6 — Nettoyage (préalable à la Phase 2)
- **Supprimer ~2000 lignes de code mort** : `components/atoms/`, `molecules/`, `organisms/`, `ui/NavBar.tsx`, `lib/animations.ts` (si plus consommé).
- Retirer la dép Anthropic SDK inutilisée (ou la câbler — décision A4).
- Resync `.env.example` (`CRON_SECRET`, `GEMINI_API_KEY`, `ENCRYPTION_KEY`, OAuth Google…). MàJ README (Docker/GHCR, plus PM2).
- Renommer le package (`portfolio-temp` → nom produit).

**Sortie de Phase 1 :** un SaaS multi-tenant fonctionnel mais « brut » visuellement. Plusieurs comptes peuvent coexister, isolés, chacun avec son Gmail.

---

## PHASE 2 — Design system unifié

### Lot 2.1 — Tokens & thème
- Rationaliser `globals.css` : système de radius unique, fix `@keyframes shimmer` cassé, retirer les échelles `--font-*`/`--space-*` inutilisées, light mode optionnel.
- Identité de marque du SaaS (couleurs, logo, nom — décision A12).

### Lot 2.2 — Primitives réutilisables (shadcn/ui)
- `Modal/Dialog`, `Button`, `Card`, `Input`, `Select`, `Tabs`, `Badge`, `Toast`, `Drawer`, `Skeleton`, `EmptyState` — un seul jeu, utilisé partout.
- Tue le pattern overlay réimplémenté ~11×. `cn()` généralisé.

### Lot 2.3 — Refactor du shell
- Source unique pour la nav (fin de la triple duplication Sidebar/MobileNav/Topbar).
- Fix l'offset sidebar repliée (variant Tailwind inexistant aujourd'hui).
- Un seul `<Toaster>`.

---

## PHASE 3 — Refonte UI + onboarding + portfolio multi-user

### Lot 3.1 — Décomposer les monstres
- `settings` (1118 l), `recherche` (1102 l), `GenerateLetterModal` (643 l) → sous-composants + hooks dédiés.

### Lot 3.2 — Onboarding wizard
- Après inscription : profil → upload CV → connexion Gmail (consent OAuth) → préférences de recherche → choix clé IA. Remplace les `PROFIL_*` de l'env (qui deviennent des données par user).

### Lot 3.3 — Portfolio public par-utilisateur
- `/{username}` rend le CV/story de cet user (toggle public/privé). Racine `/` = **landing marketing** du SaaS.

### Lot 3.4 — Dashboard data-viz
- Utiliser `recharts` (déjà installé, zéro usage aujourd'hui) : pipeline, taux de réponse, activité.

### Lot 3.5 — Passe responsive
- Fix mobile sur `relances` (0 breakpoint), `candidatures`, audit de toutes les pages.

---

## PHASE 4 — Scalabilité infra + go-to-market

### Lot 4.1 — Stockage objet
- Migrer `CVFile`/`MediaAsset` (Buffers Mongo) → R2/S3 + URLs présignées.

### Lot 4.2 — Jobs robustes
- Redis + BullMQ (file par user) quand le nombre d'users le justifie.

### Lot 4.3 — Robustesse & observabilité
- Rate-limit signup/API, Sentry (erreurs), healthcheck applicatif riche, logs structurés.

### Lot 4.4 — Tests
- **Test d'isolation tenant** (A ne lit pas B) = critique. Tests des routes API + auth. Gate CI.

### Lot 4.5 — Billing (optionnel)
- Stripe, plans (free quota / payant illimité), métrage d'usage.

### Lot 4.6 — Légal / compliance
- RGPD : politique de confidentialité, CGU, export/suppression des données, consentement cookies.
- Soumission **vérification Google OAuth** (scopes Gmail restreints).
- Délivrabilité email / réputation d'envoi.

---

## ⚠️ Risques & contraintes réelles (à connaître avant de s'engager)

1. **Vérification Google OAuth (BLOQUANT pour le public).** Les scopes Gmail `send`/`modify` sont « restreints ». Au-delà de **100 utilisateurs de test**, Google exige une **security assessment** (audit tiers, plusieurs semaines, coût possible). La beta peut rester en mode « testing » (100 users max) sans audit. → Valider très tôt.
2. **Coûts plateforme.** Clés IA/SerpAPI/RapidAPI partagées = coût qui croît avec les users. Sans quota/billing, risque financier. → Quotas dès la Phase 1.4.
3. **Délivrabilité & abus.** Envoyer / auto-postuler au nom des users peut être vu comme du spam ; limites Gmail par compte ; réputation. → Garde-fous (caps, opt-in clair).
4. **RGPD.** Stockage de CV, scraping d'entreprises, envoi d'emails au nom d'autrui = données personnelles. → Phase 4.6, mais à anticiper.
5. **Légalité du scraping** des sites d'entreprises (robots, rate-limits).

---

## Décisions encore ouvertes (à confirmer avant Phase 1)

- **A4** — Modèle clé IA : hybride plateforme-quota + BYOK ? (recommandé)
- **A7** — Portfolio public : `/{username}` (recommandé) vs `/p/{slug}` vs sous-domaine.
- **A12** — Nom / marque du produit.
- Périmètre beta : combien d'utilisateurs visés au lancement (impacte la vérification Google) ?

---

## Conventions

- **Branche** : `main` (déploiement auto GitHub Actions).
- **Build** : `docker build` local validé avant chaque push.
- **Commits** : `feat:`, `fix:`, `chore:` en français.
- **Doc** : ce fichier mis à jour à chaque lot terminé.

## Suivi des lots

| Lot | Contenu | Statut |
|---|---|---|
| 1.1 | Auth.js v5 | ⏳ |
| 1.2 | Modèle multi-tenant | ⏳ |
| 1.3 | Scoping routes & lib | ⏳ |
| 1.4 | Intégrations par user + secrets chiffrés | ⏳ |
| 1.5 | Crons multi-tenant | ⏳ |
| 1.6 | Nettoyage code mort | ⏳ |
| 2.1–2.3 | Design system | ⏳ |
| 3.1–3.5 | Refonte UI + onboarding + portfolio | ⏳ |
| 4.1–4.6 | Scalabilité + go-to-market | ⏳ |

Légende : ⏳ pending · 🟡 en cours · ✅ livré · ⚠️ bloqué

# CLAUDE.md — Agent de Recherche de Stage

> Ce fichier donne à Claude tout le contexte nécessaire pour comprendre,
> naviguer et contribuer au projet sans poser de questions redondantes.

---

## 🎯 Vision du projet

Un **dashboard personnel de recherche de stage** intégré au portfolio de Mohammed Hamiani.
L'objectif : automatiser toute la chaîne — trouver des offres, générer des lettres de motivation
personnalisées avec Claude AI, envoyer les candidatures par email, et suivre leur évolution.

Accessible uniquement par Mohammed via une clé secrète (pas d'auth utilisateur publique).

---

## 🏗️ Architecture

```
portfolio/                          ← Repo GitHub (mohadu67/Curiculum-Vitae)
├── app/                            ← Next.js App Router
│   ├── page.tsx                    ← Portfolio public (CV, projets, contact)
│   ├── dashboard/
│   │   └── page.tsx                ← Dashboard privé (protégé par clé secrète)
│   └── api/                        ← API Routes Next.js (remplace Express)
│       ├── candidatures/
│       │   ├── route.ts            ← GET /api/candidatures
│       │   └── [id]/
│       │       └── route.ts        ← PATCH /api/candidatures/:id  DELETE
│       ├── search/
│       │   └── route.ts            ← POST /api/search (Indeed + LinkedIn)
│       ├── generate-letter/
│       │   └── route.ts            ← POST /api/generate-letter (Claude API)
│       └── send-email/
│           └── route.ts            ← POST /api/send-email (Gmail SMTP)
│
├── components/
│   ├── portfolio/                  ← Composants du CV public
│   │   ├── Hero.tsx
│   │   ├── Skills.tsx
│   │   ├── Projects.tsx
│   │   └── Contact.tsx
│   └── dashboard/                  ← Composants du dashboard stage
│       ├── StatsBar.tsx            ← Compteurs par statut
│       ├── SearchPanel.tsx         ← Formulaire de recherche d'offres
│       ├── CandidatureList.tsx     ← Liste avec filtres
│       ├── CandidatureCard.tsx     ← Carte individuelle
│       └── LetterModal.tsx         ← Modal lettre + envoi email
│
├── lib/
│   ├── mongodb.ts                  ← Connexion MongoDB (singleton)
│   ├── claude.ts                   ← Wrapper Anthropic SDK
│   ├── email.ts                    ← Wrapper Nodemailer/Gmail
│   ├── scraper.ts                  ← Appels RapidAPI (Indeed + LinkedIn)
│   └── auth.ts                     ← Vérification clé secrète
│
├── models/
│   └── Candidature.ts              ← Interface TypeScript + schéma Mongoose
│
├── .env.local                      ← Variables d'environnement (jamais commit)
├── CLAUDE.md                       ← CE FICHIER
└── next.config.ts
```

---

## 🗄️ Modèle de données — Candidature (MongoDB)

```typescript
interface Candidature {
  _id: ObjectId;
  entreprise: string;
  poste: string;
  plateforme: "Indeed" | "LinkedIn" | "Autre";
  localisation: string;
  url: string;
  description: string;          // Extrait de l'offre (max 500 chars)
  email: string;                 // Email de contact de l'entreprise
  statut: CandidatureStatut;
  lettre: string | null;         // Lettre générée par Claude
  notes: string;                 // Notes personnelles
  date: string;                  // Date de l'offre (YYYY-MM-DD)
  created_at: Date;
  updated_at: Date;
}

type CandidatureStatut =
  | "identifiée"
  | "lettre générée"
  | "postulée"
  | "réponse reçue"
  | "entretien"
  | "refus"
  | "acceptée";
```

---

## 🔌 API Routes — Référence complète

### GET `/api/candidatures`
Retourne toutes les candidatures + stats agrégées.
```json
{
  "candidatures": [...],
  "stats": { "identifiée": 3, "postulée": 5, "entretien": 1 },
  "total": 9
}
```

### POST `/api/search`
Lance une recherche Indeed + LinkedIn via RapidAPI, déduplique et sauvegarde en MongoDB.
```json
// Body
{ "keywords": "stage développeur web", "location": "France", "nb_results": 10 }
// Réponse
{ "message": "8 nouvelles offres sauvegardées", "total_trouvees": 12, "nouvelles": 8 }
```

### POST `/api/generate-letter`
Génère une lettre de motivation avec Claude et la sauvegarde dans MongoDB.
```json
// Body
{ "candidature_id": "664abc..." }
// Réponse
{ "lettre": "...", "candidature_id": "664abc..." }
```

### POST `/api/send-email`
Envoie la lettre par Gmail SMTP à l'entreprise.
```json
// Body
{ "candidature_id": "664abc...", "email_destinataire": "rh@entreprise.com" }
```

### PATCH `/api/candidatures/[id]`
Met à jour statut et/ou notes.
```json
// Body
{ "statut": "entretien", "notes": "RDV le 15 mars à 14h" }
```

### DELETE `/api/candidatures/[id]`
Supprime une candidature.

---

## 🔐 Authentification

Système simple : clé secrète stockée dans `.env.local` (`API_SECRET`).
- Côté **dashboard** (`/dashboard`) : clé saisie dans un champ, stockée en `sessionStorage`
- Côté **API routes** : header `x-api-key` vérifié dans `lib/auth.ts`
- Si la clé est incorrecte → 401

```typescript
// lib/auth.ts
export function verifyAuth(request: Request): boolean {
  const key = request.headers.get("x-api-key");
  return key === process.env.API_SECRET;
}
```

---

## 🤖 Intégration Claude AI

Modèle : `claude-opus-4-5-20251101`
Fichier : `lib/claude.ts`

Le prompt de génération de lettre utilise le profil défini dans `.env.local` :
- `PROFIL_NOM`, `PROFIL_FORMATION`, `PROFIL_COMPETENCES`, `PROFIL_EXPERIENCE`
- `PROFIL_RECHERCHE`, `PROFIL_DISPO`

La lettre est en français, 3 paragraphes, max 320 mots, ton professionnel.

---

## 📧 Envoi d'emails

Via **Nodemailer** + Gmail SMTP (port 465, SSL).
Credentials dans `.env.local` : `GMAIL_USER` + `GMAIL_APP_PASSWORD`.
Le mot de passe d'application Google est obligatoire (pas le vrai mot de passe Gmail).

---

## 🌐 Sources d'offres

Via **RapidAPI** (`RAPIDAPI_KEY` dans `.env.local`) :
- **Indeed** : `indeed12.p.rapidapi.com`
- **LinkedIn** : `linkedin-data-api.p.rapidapi.com`

Les offres déjà présentes en DB (même URL) ne sont pas réinsérées.

---

## 🗃️ MongoDB

- Base : `stage_agent`
- Collection : `candidatures`
- Connexion dans `lib/mongodb.ts` via **Mongoose** (singleton pour éviter les connexions multiples en dev Next.js)
- URI : `mongodb://adminMongo:PASSWORD@127.0.0.1:27017/stage_agent?authSource=admin`

---

## ⚙️ Variables d'environnement (`.env.local`)

```bash
# Auth dashboard
API_SECRET=clé-secrète-longue-générée-avec-openssl-rand-hex-32

# Claude AI
ANTHROPIC_API_KEY=sk-ant-xxx

# MongoDB (VPS local)
MONGO_URI=mongodb://adminMongo:PASSWORD@127.0.0.1:27017/stage_agent?authSource=admin

# Gmail
GMAIL_USER=ton.email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# RapidAPI
RAPIDAPI_KEY=xxx

# Profil Mohammed (utilisé dans le prompt Claude)
PROFIL_NOM=Mohammed Hamiani
PROFIL_FORMATION=Concepteur Développeur Fullstack
PROFIL_COMPETENCES=JavaScript, React, Node.js, Python, SQL, Git, Docker
PROFIL_EXPERIENCE=Projets fullstack, UI/UX design, développement web moderne
PROFIL_RECHERCHE=Stage développeur fullstack / web
PROFIL_DISPO=Dès que possible
```

---

## 🚀 Déploiement sur VPS (Ubuntu)

Next.js tourne en mode **standalone** via **PM2**.

```bash
# Build
npm run build

# Démarrage avec PM2
pm2 start npm --name "portfolio" -- start
pm2 save && pm2 startup

# Nginx pointe vers le port 3000
# proxy_pass http://127.0.0.1:3000;
```

Le portfolio public (`/`) et le dashboard (`/dashboard`) sont sur le même serveur Next.js,
même domaine. Le dashboard n'est pas indexé (robots.txt).

---

## 🎨 Stack technique

| Couche | Techno |
|---|---|
| Framework | Next.js 14+ (App Router) |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Base de données | MongoDB (Mongoose) |
| IA | Anthropic SDK (Claude) |
| Email | Nodemailer |
| Scraping offres | RapidAPI (Indeed + LinkedIn) |
| Déploiement | VPS Ubuntu + PM2 + Nginx |

---

## 📌 Conventions de code

- **TypeScript strict** partout
- **App Router** Next.js (pas Pages Router)
- Les API routes vérifient toujours l'auth en premier
- Les erreurs retournent `{ error: string }` avec le bon status HTTP
- Les composants dashboard sont dans `components/dashboard/`
- Les composants portfolio sont dans `components/portfolio/`
- Pas de `console.log` en production — utiliser `console.error` pour les erreurs serveur

---

## 🔄 Flux utilisateur typique

```
1. Mohammed ouvre /dashboard
2. Saisit sa clé secrète → stockée en sessionStorage
3. Toutes les requêtes API partent avec le header x-api-key
4. Lance une recherche (mots-clés + ville)
   → /api/search → RapidAPI → MongoDB
5. Voit les nouvelles offres dans la liste
6. Clique "Générer lettre" sur une offre
   → /api/generate-letter → Claude AI → sauvegarde MongoDB
7. Lit la lettre dans la modal, entre l'email de l'entreprise
8. Clique "Envoyer" → /api/send-email → Gmail SMTP
9. Le statut passe automatiquement à "postulée"
10. Met à jour le statut au fil du temps (entretien, refus, acceptée…)
```

---

## ⚠️ Points d'attention pour Claude

- **Ne jamais commiter `.env.local`** — il contient des secrets
- Le dashboard `/dashboard` doit rester non-indexé par les moteurs de recherche
- MongoDB tourne en local sur le VPS, pas exposé sur internet
- Les credentials MongoDB ne doivent jamais apparaître dans le code — uniquement via `process.env.MONGO_URI`
- Next.js en App Router : les API routes sont dans `app/api/`, pas `pages/api/`
- Utiliser `next/headers` pour lire les headers dans les Server Components si besoin

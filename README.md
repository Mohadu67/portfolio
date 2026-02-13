# 🎯 Portfolio & Dashboard d'Automatisation de Recherche de Stage

Un portfolio personnel avec un dashboard privé pour **automatiser la recherche de stage** : recherche d'offres, génération de lettres de motivation avec Claude AI, envoi de candidatures par email et suivi.

## 🚀 Démarrage rapide

### 1. Installation des dépendances

```bash
npm install
```

### 2. Configuration des variables d'environnement

Copie `.env.example` en `.env` et remplis les valeurs :

```bash
cp .env.example .env
```

Puis édite `.env` avec tes clés API :

```env
# Clé secrète pour le dashboard (génère avec: openssl rand -hex 32)
API_SECRET=ta-clé-super-secrète

# Claude AI (https://console.anthropic.com/)
ANTHROPIC_API_KEY=sk-ant-...

# MongoDB (local ou Atlas)
MONGO_URI=mongodb://...

# Gmail SMTP (utilise un mot de passe d'application)
GMAIL_USER=ton@email.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# RapidAPI (https://rapidapi.com/)
RAPIDAPI_KEY=...

# Ton profil (utilisé dans les lettres de motivation)
PROFIL_NOM=Mohammed Hamiani
PROFIL_FORMATION=Concepteur Développeur Fullstack
PROFIL_COMPETENCES=JavaScript, React, Node.js, Python, SQL, Git, Docker
PROFIL_EXPERIENCE=Projets fullstack, UI/UX design, développement web moderne
PROFIL_RECHERCHE=Stage développeur fullstack / web
PROFIL_DISPO=Dès que possible
```

### 3. Lancer le serveur de développement

```bash
npm run dev
```

Accès : **http://localhost:3000**

---

## 📖 Guide d'utilisation

### 🌐 Page d'accueil (Portfolio public)

Accessible sur `/` — c'est ta vitrine publique avec :
- Présentation personnelle
- Liens vers le dashboard (protégé)
- Design moderne et responsive

### 🔒 Dashboard privé (`/dashboard`)

**Authentification requise** avec ta clé secrète (voir `.env`)

#### Fonctionnalités :

1. **🔍 Recherche d'offres**
   - Tape tes mots-clés et ta localisation
   - Récupère automatiquement les offres depuis **Indeed** et **LinkedIn** (via RapidAPI)
   - Les offres s'ajoutent à la base de données (doublons éliminés)

2. **📊 Statistiques en temps réel**
   - Compteurs par statut : identifiées, lettres générées, postulées, entretions, etc.

3. **📋 Liste des candidatures**
   - Affiche toutes tes candidatures avec leur statut
   - Clique sur une offre pour la sélectionner

4. **✍️ Génération de lettres** *(à implémenter côté UI)*
   - Génère automatiquement une lettre de motivation avec **Claude AI**
   - Personnalisée selon l'offre et ton profil

5. **📧 Envoi de candidature** *(à implémenter côté UI)*
   - Envoie la lettre par **Gmail SMTP**
   - Marque la candidature comme "postulée"

6. **📍 Suivi des candidatures**
   - Mets à jour le statut : entretien, refus, acceptée, etc.
   - Ajoute des notes personnelles

---

## 🏗️ Architecture

```
portfolio/
├── app/
│   ├── page.tsx                 ← Portfolio public
│   ├── dashboard/
│   │   └── page.tsx             ← Dashboard privé
│   └── api/                     ← Routes API
│       ├── candidatures/        ← GET/PATCH/DELETE candidatures
│       ├── search/              ← POST recherche offres
│       ├── generate-letter/     ← POST génération lettre
│       └── send-email/          ← POST envoi email
├── lib/                         ← Logique réutilisable
│   ├── auth.ts                  ← Vérification clé API
│   ├── mongodb.ts               ← Connexion BD (singleton)
│   ├── claude.ts                ← Génération lettres (Claude AI)
│   ├── email.ts                 ← Envoi emails (Gmail)
│   └── scraper.ts               ← Recherche offres (RapidAPI)
├── components/dashboard/        ← Composants UI dashboard
│   ├── SearchPanel.tsx
│   ├── StatsBar.tsx
│   └── CandidatureList.tsx
├── models/                      ← Schémas MongoDB
│   └── Candidature.ts
├── .env                         ← Variables secrètes (ignore par git)
├── .env.example                 ← Template (à versionner)
└── next.config.ts
```

---

## 🔑 Authentification

Le dashboard est protégé par une **clé secrète** :

1. Définis `API_SECRET` dans `.env` (génère avec `openssl rand -hex 32`)
2. Accède à `/dashboard`
3. Saisis la clé → stockée en `sessionStorage`
4. Toutes les requêtes API envoient le header `x-api-key`

---

## 📦 Technologies

| Couche | Stack |
|---|---|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19** + **TypeScript** |
| Styling | **Tailwind CSS 4** |
| Base de données | **MongoDB** + **Mongoose** |
| IA | **Anthropic Claude** |
| Email | **Nodemailer** + **Gmail SMTP** |
| Offres | **RapidAPI** (Indeed + LinkedIn) |

---

## 🚀 Déploiement

### Build pour production

```bash
npm run build
npm run start
```

### Sur VPS (Ubuntu + PM2 + Nginx)

```bash
# Build
npm run build

# Démarrer avec PM2
pm2 start npm --name "portfolio" -- start
pm2 save && pm2 startup

# Nginx (proxy vers 3000)
# proxy_pass http://127.0.0.1:3000;
```

---

## 🐛 Dépannage

### Erreur 500 sur `/api/search`

**Cause possible :** MongoDB indisponible ou mal configurée

→ Vérifie `MONGO_URI` dans `.env`

### Recherche ne retourne rien

**Cause possible :** Clés RapidAPI invalides ou limites atteintes

→ Teste l'API directement sur [https://rapidapi.com/](https://rapidapi.com/)

### Lettres non générées

**Cause possible :** `ANTHROPIC_API_KEY` invalide

→ Génère une nouvelle clé sur [https://console.anthropic.com/](https://console.anthropic.com/)

### Emails non envoyés

**Cause possible :** `GMAIL_APP_PASSWORD` invalide (ne pas utiliser le vrai mot de passe Gmail)

→ Génère un mot de passe d'application Gmail : https://myaccount.google.com/apppasswords

---

## 📝 Variables d'environnement détaillées

| Variable | Description | Exemple |
|---|---|---|
| `API_SECRET` | Clé authentification dashboard | `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | Claude API | `sk-ant-...` |
| `MONGO_URI` | Connexion MongoDB | `mongodb://user:pass@host:27017/db` |
| `GMAIL_USER` | Email Gmail | `mon@gmail.com` |
| `GMAIL_APP_PASSWORD` | Mot de passe d'application | `xxxx xxxx xxxx xxxx` |
| `RAPIDAPI_KEY` | RapidAPI (Indeed + LinkedIn) | `6a3ec555ddmsh...` |
| `PROFIL_*` | Tes informations personnelles | Utilisé dans les lettres |

---

## 📚 Ressources

- [Next.js Documentation](https://nextjs.org/docs)
- [Claude API](https://anthropic.com/api)
- [MongoDB Mongoose](https://mongoosejs.com/)
- [RapidAPI](https://rapidapi.com/)
- [Nodemailer](https://nodemailer.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## 📄 Licence

Projet personnel — Mohammed Hamiani

---

**Besoin d'aide ?** Consulte le fichier `CLAUDE.md` pour plus de détails techniques.

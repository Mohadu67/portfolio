# AGENTS.md — Curriculum

## Stack

- **Next.js** — App Router ou Pages Router (à vérifier dans `app/` vs `pages/`).
- **TypeScript**.
- **Tailwind CSS** (déduit de `postcss.config.mjs`).
- **ESLint 9** (`eslint.config.mjs`).
- **Docker** pour le déploiement (`Dockerfile`, `docker-compose.yml`).

## Structure

```
app/              # Routes Next.js
components/       # Composants React
lib/              # Utilitaires
models/           # Modèles de données
data/             # Données statiques
public/           # Assets publics
```

## Commandes

```bash
npm run dev       # Dev server
npm run build     # Build production
npm run lint      # ESLint
```

## Conventions

- TypeScript strict si activé ; pas de `any` non justifié.
- Composants fonctionnels React.
- Tailwind pour le styling.
- Ne jamais commit de secrets dans le code.

## Mémoire de session

- `docs/sessions/SESSION.md` : session active.
- `docs/sessions/archive/AAAA-MM-JJ-<sujet>.md` : archives.
- `docs/DECISIONS.md` : decision log.
- `docs/STATE.md` : état validé du projet.

Au démarrage, lire `docs/STATE.md`, `docs/DECISIONS.md` et `docs/sessions/SESSION.md`.
À la clôture, mettre à jour `docs/STATE.md` et archiver la session.

## Definition of done

- `npm run lint` passe.
- `npm run build` passe.
- Aucune régression fonctionnelle.

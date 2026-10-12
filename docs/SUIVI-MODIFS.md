# Suivi des modifications

## 2026-10-12 — Fix prod : clé Gemini invalide sur vpsHarmo

### Problèmes constatés
- L'agent Telegram répondait « J'ai planté en route » : logs `portfolio` → `GoogleGenerativeAI Error [400] API_KEY_INVALID` sur `gemini-2.5-flash`.
- La `GEMINI_API_KEY` du `.env` de prod (`~/srv-docker/projects/portfolio/.env`, daté du 6 juil.) était morte côté Google (test `curl` direct → HTTP 400 `API_KEY_INVALID`).
- Cause probable : rotation de la clé dans Google AI Studio (nouveau format `AQ.`) — l'ancienne clé `AIzaSy…` a été désactivée, seul le `.env` local avait la nouvelle.
- Problème latent : le compose prod ne passait aucune variable de modèle → fallback code sur `gemini-2.5-flash`, indisponible pour les nouvelles clés (cf. commit `7eec0b3`).

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `.env` (VPS) | Remplacement de `GEMINI_API_KEY` (backup : `.env.bak-20261012-gemini`) + ajout `GEMINI_MODEL=gemini-3.8-flash`, `CHAT_MODEL=gemini-3.8-flash`, `TTS_MODEL=gemini-3.8-flash-tts`, `FALLBACK_EXTRACTION_MODEL=gemini-3.8-flash`. |
| `docker-compose.yml` + `docker-compose.yml.vps-working` (VPS) | Passage des 4 variables de modèle au service `app` (backups `.bak-20261012-gemini`). Les deux copies sont modifiées car le workflow CI restaure `vps-working` à chaque déploiement. |
| `docker-compose.yml` / `docker-compose.prod.yml` (repo) | Même ajout, pour garder repo et VPS synchronisés. |

### Vérifications
- Pré-validation de la nouvelle clé depuis le VPS : `curl` generateContent `gemini-3.8-flash` → HTTP 200 ✅
- `docker compose config --quiet` sur le VPS ✅
- Container `portfolio` recréé (`up -d --force-recreate --no-deps app`) → `healthy` ✅
- Smoke test depuis l'intérieur du container avec son env réel : HTTP 200 ✅
- Démarrage Next.js propre, plus d'`API_KEY_INVALID` dans les logs ✅
- Test end-to-end Telegram : à confirmer par l'utilisateur (renvoi d'un message).

### Comment contrôler en prod
```bash
# Env du container
ssh vpsHarmo "docker exec portfolio printenv GEMINI_MODEL CHAT_MODEL"

# Logs
ssh vpsHarmo "docker logs portfolio --tail 30"
```

## 2026-08-18 — Robustesse du bot Telegram

### Problèmes constatés
- Silence après confirmation d’action (✅) : l’agent ne répondait plus quand la continuation interne échouait ou retournait `RIEN_A_AJOUTER`.
- Aucun log structuré côté Telegram : impossible de diagnostiquer les silences.
- Transcription vocale : artefacts du modèle (`Okay, I have the transcription now...`) polluaient les messages.
- Flood de propositions de prospection : jusqu’à 10 offres proposées d’un coup.
- Cache client : erreurs `Failed to find Server Action` après déploiement.

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `lib/telegram-log.ts` | **Nouveau.** Logger JSON dans `logs/telegram-YYYY-MM-DD.log` : webhook, agent, tools, actions, erreurs. Filtrage des secrets et tronçage des longues chaînes. |
| `app/api/telegram/webhook/route.ts` | Instrumentation des logs à la réception des messages/callbacks. `answerCallbackQuery` toujours appelée, même en cas d’erreur. |
| `lib/telegram-agent.ts` | - Logs sur chaque tour, tool exécuté, action proposée/confirmée/annulée.<br>- Fermeture du flux post-✅/❌ : message explicite en cas d’erreur interne ou de réponse vide.<br>- `maxOutputTokens` doublé à 4096 pour les tours internes (continuation post-✅).<br>- Prompt de transcription plus strict + fonction `cleanTranscription()` pour retirer les artefacts. |
| `lib/offer-search.ts` | `MAX_PROPOSALS_PER_RUN` réduit de 10 à 3 pour éviter de noyer l’utilisateur. |
| `next.config.ts` | `generateBuildId` + `NEXT_PUBLIC_BUILD_ID` uniques par build pour invalider le cache client. |
| `.gitignore` | Ignore le répertoire `/logs/`. |
| `tests/telegram-log.test.ts` | **Nouveau.** Tests du logger (filtrage des secrets, tronçage). |

### Vérifications
- `npx tsc --noEmit` ✅
- `npx vitest run` → 123 tests ✅
- `docker build -t curriculum-telegram-fix .` ✅
- Workflow GitHub Actions `completed success` ✅
- Déploiement VPS : conteneur `portfolio` redémarré et `healthy` ✅

### Comment contrôler en prod
```bash
# Derniers logs Telegram
ssh vpsHarmo "tail -f /home/moha/srv-docker/projects/portfolio/logs/telegram-$(date +%Y-%m-%d).log"

# État du conteneur
ssh vpsHarmo "docker ps --filter name=portfolio"
```

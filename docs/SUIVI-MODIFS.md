# Suivi des modifications

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

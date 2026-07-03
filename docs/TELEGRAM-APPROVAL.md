# Bot Telegram : validation des auto-réponses + agent conversationnel

## Parler au bot (agent IA)

Le bot répond aux **messages texte et aux vocaux 🎤** (transcription Gemini native, max 5 min
par vocal) avec les mêmes tools que le Chat IA du dashboard. Mode talkie-walkie : un vocal
reçoit une **réponse vocale** (TTS Gemini, voix `TTS_VOICE`, défaut Kore) avec le texte en
légende — fallback texte si la synthèse échoue ou si la réponse dépasse ~1500 chars :

- « qu'est-ce qui est en attente de validation ? » → liste les auto-réponses pending, peut
  renvoyer les boutons ✅/❌ d'une réponse précise
- « liste mes candidatures postulées », « détail de la candidature Extia »
- « envoie une candidature à https://entreprise.fr » → pipeline apply_to_company
- « programme une relance pour X lundi 9h », « passe Y en entretien »

Toute **action** (envoi, modification) est proposée avec des boutons **✅ Exécuter / ❌ Annuler**
— rien ne s'exécute sans tap. Les lectures (listes, détails) sont directes. La conversation
garde un historique glissant (~16 messages) pour la continuité. `/aide` affiche l'aide.

Nécessite `GEMINI_API_KEY` (déjà en prod). Seul le chat `TELEGRAM_CHAT_ID` est écouté.

# Validation Telegram des auto-réponses (human-in-the-loop)

Quand un RH répond à une candidature, l'IA (Gemini) prépare une réponse. Avec cette feature
activée, **rien ne part sans ton accord** : la réponse préparée arrive sur Telegram avec deux
boutons — ✅ Envoyer / ❌ Rejeter. Un tap sur ✅ envoie la réponse dans le thread Gmail.

## Flux

```
Mail RH → cron check-inbox → classifyAndReply (Gemini)
        → autoReply "pending" en DB + message Telegram (boutons)
        → tap ✅ → webhook /api/telegram/webhook → replyInThread → sent
        → tap ❌ → rejected, rien n'est envoyé
```

- Toutes les réponses préparées passent par Telegram, même sous le seuil de confiance
  (le score est affiché, ⚠️ si sous le seuil — c'est toi qui tranches).
- Double-tap / relivraison Telegram : claim atomique en DB → « Déjà traité ».
- Échec SMTP au moment de l'approbation : l'entrée repasse en `pending`, les boutons restent
  actifs, retape ✅ pour réessayer.
- Échec de l'appel Telegram (API down, crash entre le claim et l'envoi) : l'entrée reste en
  `pending` sans message annoncé, et chaque sync la ré-émet jusqu'à ce qu'un message parte
  (sweep `resendStalePendingApprovals`). Rien n'est perdu.
- Le mode approbation ne s'active que si les **3** variables (`TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`) sont présentes — sans le secret, les taps
  seraient intraitables côté webhook. Env incomplète ou toggle désactivé dans
  `/dashboard/settings` → comportement historique : envoi direct si confiance ≥ seuil.

## Setup (une fois)

1. **Créer le bot** : parler à [@BotFather](https://t.me/BotFather) → `/newbot` → récupérer le
   token (`123456:ABC-...`).
2. **Récupérer ton chat_id** : envoyer n'importe quel message à ton bot, puis :
   ```bash
   curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates" | jq '.result[0].message.chat.id'
   ```
3. **Variables d'env** (`.env` local + VPS) :
   ```bash
   TELEGRAM_BOT_TOKEN=123456:ABC-...
   TELEGRAM_CHAT_ID=987654321
   TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
   ```
   Puis `docker compose -f docker-compose.prod.yml up -d` pour recharger l'env.
4. **Enregistrer le webhook** (HTTPS obligatoire) :
   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d "url=https://hamiani.mohammed.harmonith.fr/api/telegram/webhook" \
     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```
   Vérifier : `curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"`
5. **Activer** : `/dashboard/settings` → « Validation Telegram avant envoi » (activé par défaut).

## Sécurité

- Le webhook vérifie le header `x-telegram-bot-api-secret-token` (sinon 401).
- Seul le chat `TELEGRAM_CHAT_ID` peut approuver/rejeter.
- Les boutons portent un token opaque (24 hex) — pas d'ID Mongo exposé.

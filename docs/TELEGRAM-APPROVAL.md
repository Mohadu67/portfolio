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
- Si Telegram n'est pas configuré (env manquantes) ou si le toggle est désactivé dans
  `/dashboard/settings`, retour au comportement historique : envoi direct si confiance ≥ seuil.

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

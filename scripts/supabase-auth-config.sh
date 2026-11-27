#!/usr/bin/env bash
# Applique les réglages Auth versionnés à un projet Supabase hébergé (API de
# gestion, jeton SUPABASE_ACCESS_TOKEN) : même réglage en dev et en prod,
# versionné ici plutôt que cliqué dans le tableau de bord.
#
# - supabase/auth.json : toujours appliqué.
# - Emails, si les secrets SMTP_USER (adresse Gmail) et SMTP_PASSWORD (mot de
#   passe d'application Google) sont définis : SMTP Gmail, limite d'envoi, code
#   à 6 chiffres (supabase/auth-email.json) et modèle supabase/templates/code.html
#   pour la connexion (magic_link) et le premier email d'un compte (confirmation).
#   Supabase refuse de modifier les modèles d'email sans SMTP personnalisé.
#
# Seules les clés envoyées sont affichées, jamais le reste de la configuration
# (les journaux d'Actions de ce dépôt sont publics) ; ni le mot de passe SMTP,
# ni l'adresse, ni le contenu des modèles.
#
# Usage : scripts/supabase-auth-config.sh <ref-du-projet>
set -euo pipefail
ref="${1:?ref du projet Supabase manquante}"
dir="$(dirname "$0")/../supabase"

payload="$(cat "$dir/auth.json")"

if [[ -n "${SMTP_USER:-}" && -n "${SMTP_PASSWORD:-}" ]]; then
  payload="$(jq \
    --slurpfile email "$dir/auth-email.json" \
    --rawfile code "$dir/templates/code.html" \
    --arg user "$SMTP_USER" --arg pass "$SMTP_PASSWORD" \
    '. + $email[0] + {
      smtp_user: $user, smtp_pass: $pass, smtp_admin_email: $user,
      mailer_templates_magic_link_content: $code,
      mailer_templates_confirmation_content: $code
    }' <<<"$payload")"
else
  echo "::warning::Secrets SMTP_USER et SMTP_PASSWORD absents : emails par défaut de Supabase (2 par heure, sans code de connexion)."
fi

response="$(curl -sS -X PATCH \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:?jeton manquant}" \
  -H "Content-Type: application/json" \
  --data @- \
  -w '\n%{http_code}' \
  "https://api.supabase.com/v1/projects/$ref/config/auth" <<<"$payload")"
status="${response##*$'\n'}"
body="${response%$'\n'*}"

if [[ "$status" != 2* ]]; then
  echo "::error::Réglages Auth refusés (HTTP $status) : $(jq -r '.message // .error // .' <<<"$body" 2>/dev/null || echo "$body")"
  exit 1
fi

jq --argjson want "$payload" '
  with_entries(select(.key as $k | $want | has($k)))
  | with_entries(
      if (.key | test("_content$")) then .value = "\(.value | length) caractères"
      elif (.key | test("^smtp_(user|pass|admin_email)$")) then .value = (if .value then "défini" else "absent" end)
      else . end)' <<<"$body"

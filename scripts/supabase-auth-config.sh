#!/usr/bin/env bash
# Applique supabase/auth.json et les modèles d'email (supabase/templates) aux
# réglages Auth d'un projet Supabase hébergé (API de gestion, jeton
# SUPABASE_ACCESS_TOKEN) : même réglage en dev et en prod, versionné ici plutôt
# que cliqué dans le tableau de bord.
#
# Le modèle code.html (code à 6 chiffres, plus un lien de secours) sert à la
# connexion par email (magic_link) et au premier email d'un nouveau compte
# (confirmation).
#
# Seules les clés envoyées sont affichées, jamais le reste de la configuration
# (les journaux d'Actions de ce dépôt sont publics) ; les modèles, par leur taille.
#
# Usage : scripts/supabase-auth-config.sh <ref-du-projet>
set -euo pipefail
ref="${1:?ref du projet Supabase manquante}"
dir="$(dirname "$0")/../supabase"

payload="$(jq --rawfile code "$dir/templates/code.html" \
  '. + {mailer_templates_magic_link_content: $code, mailer_templates_confirmation_content: $code}' \
  "$dir/auth.json")"

curl -fsS -X PATCH \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:?jeton manquant}" \
  -H "Content-Type: application/json" \
  --data "$payload" \
  "https://api.supabase.com/v1/projects/$ref/config/auth" \
  | jq --argjson want "$payload" '
      with_entries(select(.key as $k | $want | has($k)))
      | with_entries(if (.key | endswith("_content")) then .value = "\(.value | length) caractères" else . end)'

#!/usr/bin/env bash
# Applique supabase/auth.json aux réglages Auth d'un projet Supabase hébergé
# (API de gestion, jeton SUPABASE_ACCESS_TOKEN) : même réglage en dev et en prod,
# versionné ici plutôt que cliqué dans le tableau de bord.
#
# Seules les clés du fichier sont affichées, jamais le reste de la configuration
# (les journaux d'Actions de ce dépôt sont publics).
#
# Usage : scripts/supabase-auth-config.sh <ref-du-projet>
set -euo pipefail
ref="${1:?ref du projet Supabase manquante}"
file="$(dirname "$0")/../supabase/auth.json"

curl -fsS -X PATCH \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:?jeton manquant}" \
  -H "Content-Type: application/json" \
  --data @"$file" \
  "https://api.supabase.com/v1/projects/$ref/config/auth" \
  | jq --slurpfile want "$file" 'with_entries(select(.key as $k | $want[0] | has($k)))'

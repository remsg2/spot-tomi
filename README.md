# Spot Tomi

PWA qui recense les lieux du monde où les stickers de Tomi ont été collés.
Next.js (App Router) · Supabase (Postgres + PostGIS, Auth, Storage) · Vercel.

Les spécifications complètes avancent en 8 étapes (une pull request chacune).
Les maquettes de référence sont copiées dans [`docs/maquettes/`](docs/maquettes/).

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY
npx supabase start           # Supabase local (Docker), affiche l'URL et la clé
npm run dev
```

| Commande | Rôle |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint, TypeScript strict |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Playwright (démarre `npm run start` si `PLAYWRIGHT_BASE_URL` est vide) |
| `npm run test:db` | Tests pgTAP sur la base locale (`supabase/tests/database`) |
| `npm run check:bundle` | Vérifie qu'aucune URL ou clé Supabase n'est dans le bundle client |

## Configuration lue au runtime

Next.js grave les variables `NEXT_PUBLIC_*` dans le bundle au build. L'app n'en utilise
**aucune** pour la configuration, qui ne dépend donc jamais de la build :

- `src/lib/env/server.ts` lit `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et `APP_ENV`
  **au runtime** (`await connection()`).
- `<RuntimeEnv />`, rendu dans le layout racine, les transmet au navigateur dans un
  `<script type="application/json">`, lu par `src/lib/env/client.ts`.
- `/api/health` renvoie `appEnv`, `buildId` (le commit construit), l'hôte Supabase
  et la version du schéma : la CI s'en sert pour vérifier la production après chaque
  déploiement.

`scripts/check-bundle.mjs` (CI) et `e2e/socle.spec.ts` (contre le site déployé)
échouent si une URL Supabase apparaît dans un fichier JS.

## Pipeline (`.github/workflows`)

Il n'y a pas d'environnement de staging : Supabase dev sert au développement local et à
vérifier les migrations avant la prod.

1. **Pull request** (`ci.yml`) : lint, typecheck, Vitest, build, contrôle du bundle,
   Playwright sur la build locale, migrations + pgTAP sur une base Supabase locale.
2. **Merge sur `main`** (`deploy.yml`) :
   1. migrations et fonctions sur `spot-tomi-dev` : une migration cassée échoue ici ;
   2. job `production` (validation manuelle si l'environnement GitHub l'exige) :
      migrations et fonctions sur `spot-tomi-prod`, `vercel build`, contrôle du bundle,
      `vercel deploy --prebuilt --prod`, puis `/api/health` et Playwright contre le
      site en ligne.
3. **Retour arrière** (`rollback.yml`, manuel) : `vercel rollback <déploiement>`,
   sans reconstruction.

Les tests Playwright tournent sur le vrai site : ils doivent rester **en lecture
seule**. Les tests qui écrivent des données tournent sur la base locale de la CI.

Les migrations doivent rester compatibles avec la version précédente de l'app
(ajouter avant de retirer) : la base de prod change avant le code de prod.

## Mise en place (à faire une fois, hors code)

### Supabase

1. Deux projets : `spot-tomi-dev` (développement) et `spot-tomi-prod`.
2. *Authentication → URL Configuration* :
   - dev : *Site URL* `http://localhost:3000`, *Redirect URLs* `http://localhost:3000/**` ;
   - prod : *Site URL* = adresse de production, *Redirect URLs* = la même suivie de `/**`.
3. Un jeton d'accès personnel (*Account → Access Tokens*) pour la CI.

### Vercel (offre Hobby)

1. Projet `spot-tomi`. `vercel.json` désactive les déploiements Git automatiques
   (seule la CI déploie) et place les fonctions à Paris (`cdg1`) ; `package.json`
   fixe Node.js 22.
2. Variables d'environnement **Production** uniquement (ni `NEXT_PUBLIC_`, ni valeur
   au build) : `APP_ENV=production`, `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` de
   `spot-tomi-prod`.

### GitHub

*Settings → Secrets and variables → Actions* :

- secrets du dépôt : `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
  `SUPABASE_ACCESS_TOKEN` ;
- variable du dépôt `PRODUCTION_URL`, seulement si l'adresse de production n'est pas
  `https://spot-tomi.vercel.app`.

*Settings → Environments* :

| Environnement | Protection | Secret | Variable |
| --- | --- | --- | --- |
| `dev` | aucune | `SUPABASE_DB_PASSWORD` (dev) | `SUPABASE_PROJECT_REF` (ref de `spot-tomi-dev`) |
| `production` | *Required reviewers* (facultatif) | `SUPABASE_DB_PASSWORD` (prod) | `SUPABASE_PROJECT_REF` (ref de `spot-tomi-prod`) |

## Comptes (Supabase Auth)

- Connexion par **lien magique** ou **mot de passe** (`/login`). Google et Apple sont prêts
  mais désactivés : les ajouter à `ENABLED_OAUTH_PROVIDERS` (`src/lib/auth/providers.ts`)
  après les avoir configurés dans Supabase (tableau ci-dessous). Tous
  les retours passent par `/auth/callback`, qui envoie vers `/welcome` tant que le pseudo
  n'est pas choisi.
- `src/proxy.ts` rafraîchit la session et réserve `/me`, `/welcome`, `/spots/new` et
  `/admin` aux connectés ; `/dev/*` répond 404 en production.
- Domicile : `set_my_home` l'arrondit à 0,01° (~1 km) ; seul son propriétaire peut le relire
  (`get_my_home`), et l'interface n'affiche jamais de coordonnées.
- Suppression du compte : Edge Function `delete-account` (fichiers Storage puis compte Auth ;
  profil, domicile et stickers suivent en cascade).

**Réglages à faire dans chaque projet Supabase** (*Authentication → Sign In / Providers*) :

| Fournisseur | À faire |
| --- | --- |
| Email | activé par défaut. L'envoi d'emails intégré est limité à quelques messages par heure : configurer un SMTP (*Authentication → Emails → SMTP Settings*) avant l'ouverture au public. |
| Google | créer un client OAuth « Application Web » dans Google Cloud, avec l'URI de redirection `https://<ref>.supabase.co/auth/v1/callback`, puis coller l'ID et le secret dans Supabase. |
| Apple | nécessite un compte Apple Developer (payant) : Services ID, clé « Sign in with Apple », même URI de redirection. |

## Image de Tomi

Images provisoires tirées des maquettes dans `public/tomi/` (`tomi.png` pour le
sticker, `tomi-head.png` recadrée pour les marqueurs), référencées uniquement par
`src/lib/tomi.ts`. Pour passer au détouré HD, remplacer ces fichiers et ajuster
leurs dimensions dans ce module.

## Textes

Toute l'interface est en français, avec les textes regroupés dans `src/i18n/fr.ts`.

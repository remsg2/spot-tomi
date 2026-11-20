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

## Une build pour deux environnements

Next.js grave les variables `NEXT_PUBLIC_*` dans le bundle au build. L'app n'en utilise
**aucune** pour la configuration :

- `src/lib/env/server.ts` lit `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et `APP_ENV`
  **au runtime** (`await connection()`).
- `<RuntimeEnv />`, rendu dans le layout racine, les transmet au navigateur dans un
  `<script type="application/json">`, lu par `src/lib/env/client.ts`.
- `/api/health` renvoie `appEnv`, `buildId` (le commit construit), l'hôte Supabase
  et la version du schéma : la CI s'en sert pour prouver que staging et prod servent
  la même build, chacune branchée sur son propre projet Supabase.

`scripts/check-bundle.mjs` (CI) et `e2e/socle.spec.ts` (contre le déploiement)
échouent si une URL Supabase apparaît dans un fichier JS.

## Pipeline (`.github/workflows`)

1. **Pull request** (`ci.yml`) : lint, typecheck, Vitest, build, contrôle du bundle,
   Playwright sur la build locale, migrations + pgTAP sur une base Supabase locale.
2. **Merge sur `main`** (`deploy.yml`) :
   `vercel build --prod` **une seule fois** → artefact → migrations et fonctions sur
   `spot-tomi-dev` → `vercel deploy --prebuilt` sur l'environnement Vercel `staging`
   → Playwright contre staging.
3. **Validation manuelle** (environnement GitHub `production` protégé) : migrations et
   fonctions sur `spot-tomi-prod`, puis la **même** sortie est déployée avec
   `vercel deploy --prebuilt --prod`, et `/api/health` est vérifié.
4. **Retour arrière** (`rollback.yml`, manuel) : `vercel rollback <déploiement>`.

`vercel deploy --prebuilt` refuse une sortie construite pour une autre cible. Comme
aucune valeur d'environnement n'est lue au build, la sortie est identique pour toutes
les cibles, sauf le champ `target` de `.vercel/output/builds.json`.
`scripts/vercel-output.mjs` modifie ce seul champ et calcule une empreinte SHA-256
de tout le reste. La CI vérifie que cette empreinte est la même au build, sur staging
et en production.

Les migrations doivent rester compatibles avec la version précédente de l'app
(ajouter avant de retirer) : la base de prod change avant le code de prod.

## Mise en place (à faire une fois, hors code)

### Supabase

1. Créer deux projets : `spot-tomi-dev` et `spot-tomi-prod`.
2. Dans chacun, *Authentication → URL Configuration* : *Site URL* = domaine de
   l'environnement (domaine de test pour dev, domaine public pour prod) et
   *Redirect URLs* correspondantes. Les fournisseurs Google et Apple arrivent à l'étape 3.
3. Créer un jeton d'accès personnel (*Account → Access Tokens*) pour la CI.

### Vercel

1. Créer le projet et le relier à ce dépôt. `vercel.json` désactive les déploiements
   Git automatiques : seule la CI déploie.
2. *Settings → Environments* : créer l'environnement personnalisé **`staging`** et lui
   attacher le domaine de test.
3. Variables d'environnement (ni `NEXT_PUBLIC_`, ni valeur au build) :

   | Variable | staging | production |
   | --- | --- | --- |
   | `APP_ENV` | `staging` | `production` |
   | `SUPABASE_URL` | URL de `spot-tomi-dev` | URL de `spot-tomi-prod` |
   | `SUPABASE_PUBLISHABLE_KEY` | clé publishable dev | clé publishable prod |

4. *Settings → Deployment Protection* : activer *Protection Bypass for Automation* et
   noter le secret.

### GitHub

*Settings → Secrets and variables → Actions*, secrets du dépôt :
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
`VERCEL_AUTOMATION_BYPASS_SECRET`, `SUPABASE_ACCESS_TOKEN`.

*Settings → Environments* :

| Environnement | Protection | Secret | Variable |
| --- | --- | --- | --- |
| `dev` | aucune | `SUPABASE_DB_PASSWORD` (dev) | `SUPABASE_PROJECT_REF` (ref de `spot-tomi-dev`) |
| `production` | *Required reviewers* | `SUPABASE_DB_PASSWORD` (prod) | `SUPABASE_PROJECT_REF` (ref de `spot-tomi-prod`) |

## Image de Tomi

Images provisoires tirées des maquettes dans `public/tomi/` (`tomi.png` pour le
sticker, `tomi-head.png` recadrée pour les marqueurs), référencées uniquement par
`src/lib/tomi.ts`. Pour passer au détouré HD, remplacer ces fichiers et ajuster
leurs dimensions dans ce module.

## Textes

Toute l'interface est en français, avec les textes regroupés dans `src/i18n/fr.ts`.

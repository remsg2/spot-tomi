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
4. **Sauvegarde** (`backup.yml`, chaque nuit) : export chiffré de la base de production
   (photos le dimanche), gardé 30 jours. Mise en place et restauration :
   [`docs/sauvegardes.md`](docs/sauvegardes.md).

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
| `production` | *Required reviewers* (facultatif) | `SUPABASE_DB_PASSWORD` (prod), `BACKUP_PASSPHRASE` | `SUPABASE_PROJECT_REF` (ref de `spot-tomi-prod`) |

### Données de démo

Le workflow manuel **« Données de démo »** (*Actions → Run workflow*) agit sur le projet
choisi (`dev` ou `production`) :

- **remplir** : 8 comptes `demo_*` et 300 stickers par défaut (2 000 au plus,
  `supabase/demo/generator.sql`), en complétant jusqu'à la cible sans la dépasser.
  Éditions officielles 2025-2027 : imposées en dev, ajoutées en production seulement si
  aucune n'existe (une couleur choisie dans l'admin n'est jamais écrasée) ;
- **vider** : supprime les comptes `demo_*` et tout ce qui leur appartient
  (`supabase/demo/clear.sql`), puis recalcule les points des vrais stickers, calculés
  pendant la démo en tenant compte des stickers de démo. En production, le générateur
  est aussi retiré.

Les stickers de démo n'ont pas de vraie photo : la fiche affiche le visuel officiel de
leur édition (`public/editions/{année}.webp`).
En production, la démo est **publique** (carte et classement).

## Comptes (Supabase Auth)

- Connexion par **mot de passe** ou par **code à 6 chiffres reçu par email** (`/login`). Le
  code se tape dans la page qui l'a demandé : il marche aussi dans l'app installée sur
  iPhone, dont le stockage est séparé de Safari (où s'ouvrent les liens des emails).
  L'email contient aussi un lien de secours. Modèle : `supabase/templates/code.html`,
  appliqué avec `supabase/auth.json` à dev et prod à chaque déploiement
  (`scripts/supabase-auth-config.sh`). Google et Apple sont prêts
  mais désactivés : les ajouter à `ENABLED_OAUTH_PROVIDERS` (`src/lib/auth/providers.ts`)
  après les avoir configurés dans Supabase (tableau ci-dessous). Tous
  les retours passent par `/auth/callback`, qui envoie vers `/welcome` tant que le pseudo
  n'est pas choisi.
- `src/proxy.ts` rafraîchit la session et réserve `/me`, `/welcome`, `/spots/new` et
  `/admin` aux connectés ; `/dev/*` répond 404 en production.
- Aucun domicile n'est demandé ni stocké : la position d'un sticker est publique telle
  quelle, ce que l'app rappelle avant chaque publication.
- Suppression du compte : Edge Function `delete-account` (fichiers Storage puis compte Auth ;
  profil, stickers, journal de points, badges et likes suivent en cascade). Un admin peut
  aussi supprimer le compte d'un autre membre (motif obligatoire, journalisé par
  `record_admin_account_deletion` avant toute suppression ; jamais un autre admin).

**Réglages à faire dans chaque projet Supabase** (*Authentication → Sign In / Providers*) :

| Fournisseur | À faire |
| --- | --- |
| Email | activé par défaut. L'envoi d'emails intégré est limité à quelques messages par heure : configurer un SMTP (*Authentication → Emails → SMTP Settings*) avant l'ouverture au public. |
| Google | créer un client OAuth « Application Web » dans Google Cloud, avec l'URI de redirection `https://<ref>.supabase.co/auth/v1/callback`, puis coller l'ID et le secret dans Supabase. |
| Apple | nécessite un compte Apple Developer (payant) : Services ID, clé « Sign in with Apple », même URI de redirection. |

## Publication d'un sticker (`/spots/new`)

- Dans le navigateur : lecture EXIF (exifr) **avant tout envoi**, conversion HEIC à la
  demande (heic-to), réencodage canvas en WebP de 2048 px au plus, sans aucune métadonnée
  (libwebp en WebAssembly si le navigateur n'encode pas le WebP, comme Safari), puis envoi
  dans `spot-photos/{user_id}/{uuid}.webp`.
- Edge Function `publish-spot` : vérifie le jeton, refuse tout WebP qui contient encore
  EXIF, XMP, ICC ou un chunk inconnu, cherche la ville (Photon par défaut ; secret
  facultatif `GEOCODER_URL` : autre URL Photon, URL Nominatim ou `none`), puis appelle
  `create_spot` (limites, édition, date, points ; codes d'erreur `ST001` à `ST006`).
  L'altitude absente de la photo est demandée à Open-Meteo (secret facultatif
  `ELEVATION_URL`, ou `none`).
- Le membre choisit l'**édition** de son sticker et la **date du collage** (préremplie avec
  celle de la photo, sinon du jour), et peut ajouter un commentaire. Le sticker est
  **publié tout de suite** ; une position placée à la main le signale aux modérateurs.
- Une miniature WebP de 480 px (`….thumb.webp`) sert aux listes et au fil photo ; une
  empreinte de la photo (dHash) repère les photos quasi identiques pour la modération.
- **Cadrage** : à l'étape de vérification, la photo s'affiche en entier et le membre peut
  toucher son sticker. Ce point (`spots.focus_x` / `focus_y`, de 0 à 1) centre la photo
  partout où elle est recadrée (fiche, fil photo, vignettes). L'auteur peut le corriger
  depuis sa fiche (« Cadrage de l'aperçu »), un modérateur aussi (journalisé) ; une
  nouvelle photo le remet au centre. Sur la fiche, le bouton « Voir la photo en entier »
  ouvre une visionneuse plein écran (zoom au double toucher, au pincement ou à la molette).

## Points (cahier des charges V1.1)

- **100 points de base** par sticker publié, plus un **bonus de rareté** selon la
  catégorie du lieu : touristique +20 (site OpenStreetMap à moins de 300 m), remarquable
  +50 (choisi par un modérateur), isolé +100 (pays rare, ≥ 3 000 m, à plus de 50 km
  d'une ville de 15 000 habitants, ou en mer), très rare +200 (pays extrême, ≥ 4 000 m,
  à plus de 300 km). Pas de bonus à moins de 200 m d'un sticker existant.
- Valeurs réglables dans *Admin → Barème* (`scoring_rules`), lisibles par tous sur
  `/points`. Un modérateur peut imposer la catégorie d'un sticker (motif obligatoire).
- Chaque variation est écrite dans le **journal de points** (`points_ledger`) ; le
  classement (vue matérialisée `leaderboard`) est calculé à partir de ce journal.
  *Admin → Barème → Recalculer* refait tous les calculs (motif journalisé).
- Villes de référence : `supabase/migrations/20261130000001_villes.sql`, généré par
  `node scripts/generate-cities-sql.mjs` (données GeoNames, CC BY 4.0).

## Éditions

Une édition par année (*Admin → Éditions*) : nom, couleur, visuel, statut. La couleur
d'une édition passée qui a des stickers est **figée** ; celle de l'édition en cours reste
modifiable. Visuels officiels livrés dans `public/editions/` (2025 orange, 2026 rose,
2027 vert) ; un visuel envoyé depuis l'admin (bucket `editions`) les remplace.

## Suivi des erreurs et pages légales

- Les erreurs serveur (`src/instrumentation.ts`) et client (error boundaries, envois de
  photo) sont enregistrées par `log_app_error` (limité, 30 jours) : *Admin → Erreurs*.
- Brouillons à faire relire avant l'ouverture : `/confidentialite`, `/cgu`, `/moderation`
  (textes dans `src/i18n/legal.fr.ts`, passages entre crochets à compléter).
- `/dev/publish` : le même parcours avec des services simulés (tests Playwright).
  Photos de test : `python3 e2e/fixtures/make-fixtures.py` (Pillow).

## Image de Tomi

Images provisoires tirées des maquettes dans `public/tomi/` (`tomi.png` pour le
sticker, `tomi-head.png` recadrée pour les marqueurs), référencées uniquement par
`src/lib/tomi.ts`. Pour passer au détouré HD, remplacer ces fichiers et ajuster
leurs dimensions dans ce module.

## Textes

Toute l'interface est en français, avec les textes regroupés dans `src/i18n/fr.ts`.

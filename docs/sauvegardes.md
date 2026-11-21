# Sauvegardes et restauration

Cahier des charges, section 16 : sauvegarde quotidienne de la base, chiffrée, avec une
procédure de restauration écrite et testée.

## Ce qui est sauvegardé

| Quoi | Quand | Où | Durée |
| --- | --- | --- | --- |
| Base de production : rôles, schéma, données (comptes Auth, profils, stickers, journal de points, badges, modération, index Storage) | Tous les jours à 03:17 UTC | Artifact du workflow « Sauvegarde » | 30 jours |
| Photos : buckets `spot-photos`, `avatars`, `editions` | Le dimanche (ou à la demande) | Dans la même archive | 30 jours |

Supabase garde aussi ses propres sauvegardes quotidiennes (7 jours sur l'offre Pro, et la
restauration à la seconde près en option). Les sauvegardes du workflow s'y ajoutent :
elles restent lisibles hors de Supabase et suivent les données sur 30 jours.

L'archive `spot-tomi-AAAA-MM-JJTHHMMZ.tar.gz.gpg` contient :

- `roles.sql`, `schema.sql`, `data.sql` : export `supabase db dump` ;
- `bilan.txt` : version du schéma, nombre de stickers et de membres au moment de l'export ;
- `storage/<bucket>/…` : les fichiers, si les photos ont été copiées.

Elle est chiffrée en AES-256 (gpg, chiffrement symétrique) avec la phrase secrète
`BACKUP_PASSPHRASE`. Le fichier `.sha256` à côté permet de vérifier qu'elle est intacte.

## Mise en place (une fois)

1. Générer une phrase secrète longue (au moins 20 caractères, idéalement 6 mots ou plus)
   et la ranger dans le gestionnaire de mots de passe de l'équipe. **Sans elle, aucune
   sauvegarde n'est lisible.**
2. GitHub → Settings → Environments → `production` → secret `BACKUP_PASSPHRASE`.
3. Les secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` et la variable
   `SUPABASE_PROJECT_REF` du déploiement servent aussi à la sauvegarde.
4. Lancer une première fois : Actions → « Sauvegarde » → Run workflow (cocher « photos »),
   puis faire l'essai de restauration ci-dessous.

Si une sauvegarde échoue, GitHub envoie un email aux personnes qui suivent le dépôt.

## Restaurer

À faire **sur un projet Supabase vide** (nouveau projet, ou projet de test). Ne jamais
restaurer par-dessus la production en service : créer un nouveau projet, restaurer, vérifier,
puis basculer l'app (variables Vercel) vers ce projet.

Outils : `gpg`, `psql` 15 ou plus récent, la CLI Supabase.

```bash
# 1. Télécharger l'archive (Actions → Sauvegarde → l'exécution voulue → Artifacts), puis :
sha256sum -c spot-tomi-*.sha256
gpg --decrypt spot-tomi-*.tar.gz.gpg | tar -xz -C restauration/
cat restauration/bilan.txt

# 2. Chaîne de connexion du projet cible : Dashboard → Connect → Session pooler.
export CIBLE="postgresql://postgres.<ref>:<mot de passe>@<hôte>:5432/postgres"

# 3. Rôles, schéma puis données, en une seule transaction.
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file restauration/roles.sql \
  --file restauration/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file restauration/data.sql \
  --dbname "$CIBLE"
```

`session_replication_role = replica` désactive les déclencheurs pendant le chargement : le
journal de points et les badges sont restaurés tels quels, sans être recalculés ni dupliqués.

Ensuite, dans le projet restauré :

```sql
-- Le classement est une vue matérialisée : la recalculer.
select public.refresh_leaderboard();
-- Comparer avec bilan.txt.
select public.schema_version(), (select count(*) from public.spots), (select count(*) from public.profiles);
```

4. Photos : recopier chaque bucket (les buckets sont recréés par `data.sql`) :

```bash
supabase link --project-ref <ref du projet cible>
for bucket in spot-photos avatars editions; do
  supabase storage cp --experimental -r "restauration/storage/$bucket" "ss:///$bucket"
done
```

5. Fonctions Edge et réglages Auth : relancer le workflow « Déploiement » vers le projet
   cible (ou `supabase functions deploy` et `supabase config push`), puis reporter dans
   Vercel l'URL et la clé publique du nouveau projet.

6. Vérifier : la carte s'affiche, un sticker s'ouvre avec sa photo, la connexion par lien
   magique fonctionne, la page Admin → Erreurs est vide.

## Essai de restauration

Une sauvegarde jamais restaurée n'est pas une sauvegarde. Une fois par trimestre (et après
tout changement de ce workflow) :

1. créer un projet Supabase de test ;
2. y restaurer la dernière sauvegarde avec la procédure ci-dessus ;
3. noter la date, la durée et les écarts éventuels dans le tableau ci-dessous ;
4. supprimer le projet de test.

| Date | Sauvegarde restaurée | Durée | Résultat |
| --- | --- | --- | --- |
| à faire | | | |

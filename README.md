# Kajye — Plateforme de vente de cahiers de cours numériques (Bénin)

Prototype fonctionnel complet (backend + frontend) basé sur le cahier des charges fourni.
Couvre la **priorité de la première version** (section 31 du prompt) : catalogue, comptes,
aperçu gratuit, achat via Moov Money (mode sandbox), téléchargement sécurisé avec filigrane,
bibliothèque personnelle, tableau de bord propriétaire, gestion des cahiers/administrateurs,
historique des transactions, sécurité de base (prix et droits vérifiés côté serveur).

## Structure

```
backend/    API Node.js/Express + SQLite (better-sqlite3)
frontend/   Application React (Vite) mobile-first
```

## 1. Lancer le backend

```bash
cd backend
npm install
cp .env.example .env      # puis ajustez JWT_SECRET en production
npm run seed               # crée le compte propriétaire + des cahiers d'exemple
npm start                  # démarre l'API sur http://localhost:4000
```

Identifiants propriétaire créés par le seed (modifiables dans `.env` avant de lancer le seed) :
- email : `owner@cahiers-benin.com`
- mot de passe : `ChangeMe123!`

**Changez ce mot de passe immédiatement en production.**

## 2. Lancer le frontend

Dans un second terminal :

```bash
cd frontend
npm install
npm run dev                # démarre sur http://localhost:5173, proxifie /api vers :4000
```

Ouvrez `http://localhost:5173` sur votre téléphone ou navigateur.

## 3. Paiement Moov Money

Le module `backend/utils/payments.js` fonctionne en **mode sandbox** par défaut : il simule
le cycle de vie d'un paiement (demande envoyée → confirmé) sans appel réseau réel, ce qui
permet de tester tout le parcours d'achat sans contrat marchand.

Pour brancher le vrai service Moov Money Bénin :
1. Obtenez vos identifiants API marchand auprès de Moov Africa (client_id, client_secret,
   numéro marchand).
2. Complétez les appels HTTP réels dans `moovMoneyProvider.initiate()` et `.checkStatus()`.
3. Passez `MOOV_MODE=live` dans `.env`.

Le système est conçu de façon **modulaire** (voir `getProvider`/`registerProvider`) pour
ajouter facilement d'autres moyens de paiement (autre mobile money, carte bancaire) sans
toucher au reste du code.

## 4. Ce qui est déjà implémenté (voir le prompt original)

- §2-3 Classes, séries, prix modifiables par cahier
- §4 Aperçu gratuit avec nombre de pages configurable (extraction réelle des N premières
  pages du PDF, jamais le fichier complet)
- §5-6 Parcours d'achat complet, paiement vérifié côté serveur avant déblocage
- §9-10 Comptes, bibliothèque personnelle, téléchargement sécurisé par lien temporaire
  (jamais d'URL statique devinable)
- §11 Filigrane automatique (nom, n° de commande, date) apposé à la volée sur le PDF
- §12-13 Rôles (propriétaire, admin contenu/validation/utilisateurs), workflow de
  publication (brouillon → en attente → publié/refusé/archivé)
- §17-19 Tableau de bord propriétaire (revenus jour/semaine/mois/total, classements,
  transactions), journal d'activité
- §22-23 Statuts de transaction robustes (pending/success/failed/refunded), remboursements
- §24 Sécurité : prix et permissions toujours vérifiés côté serveur, jamais côté client

## 5. Prochaines étapes suggérées

- Brancher l'API Moov Money réelle (voir ci-dessus)
- Héberger le backend + la base de données sur un serveur (ex: Render, Railway, VPS) et le
  frontend sur un CDN (ex: Vercel, Netlify), avec `VITE`-proxy remplacé par l'URL de l'API
- Ajouter l'upload de couverture par défaut si aucune image n'est fournie
- Ajouter des notifications par email/SMS (actuellement le système ne fait qu'enregistrer
  les événements dans le journal d'activité)
- Système de commission auteur (§20) — désactivé dans cette première version comme demandé

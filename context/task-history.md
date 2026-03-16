# Task History — SaaS BTP

---

## [2026-03-16] — Frontend Agent — VehiclesPage complète (CRUD + stats)

### Tâche
Remplacer le stub `VehiclesPage.tsx` par la page complète de gestion du parc d'engins.
Implémenter également le service `vehicles.ts` (déjà présent et conforme — aucune modification nécessaire).

### Fichiers créés / modifiés

#### 1. `frontend/src/services/vehicles.ts` — CONFORME (aucune modification)
Le service était déjà complet et conforme au cahier des charges :
- Interfaces : `VehicleItem`, `CreateVehiclePayload`, `UpdateVehiclePayload`, `VehiclesListResponse`, `VehicleStats`, `VehicleListParams`
- Classe `VehiclesService` avec : `listVehicles`, `getVehicle`, `getStats`, `createVehicle`, `updateVehicle` (PUT), `updateStatus` (PATCH `/:id/status`), `deleteVehicle`
- Exports : `export const vehiclesService` (named) + `export default vehiclesService`

#### 2. `frontend/src/pages/VehiclesPage.tsx` — REMPLACÉ (stub → page complète)
Page complète de gestion du parc d'engins. Structure :

**Header** : pattern identique aux autres pages (`<Truck>` dans `bg-primary-100 p-2 rounded-lg` + `<UserMenu />`)

**Protection d'accès :**
- `useEffect` → `navigate('/login')` si `!isAuthenticated`
- Mur "Accès refusé" si permission `VEHICLES_READ` absente

**Stats cards** (`StatsCards`) :
- 4 cartes côte à côte en `grid-cols-2 sm:grid-cols-4`
- Total engins (gris) / Disponibles (vert) / En location (bleu) / En maintenance (orange)
- Skeleton individuel par carte pendant le chargement
- Rechargement automatique après création / changement de statut / suppression

**Barre d'actions :**
- Titre "Parc d'engins" + compteur pluralisé
- Bouton `<RefreshCw>` pour rafraîchir manuellement (tourne en spin pendant `isLoading`)
- Bouton "Ajouter un engin" (`<Plus>`) conditionnel sur `Permission.VEHICLES_CREATE`

**Filtres :**
- Input recherche avec debounce 300 ms (`useRef<ReturnType<typeof setTimeout>>`)
- Select type : Tous les types + options `VehicleType` avec `TYPE_LABELS`
- Select statut : Tous les statuts + options `VehicleStatus`
- Chaque changement de filtre reset la page à 1

**Tableau (7 colonnes) :**
- **Engin** : `name` (bold) + `internalCode` (gris, text-xs)
- **Type** : `TYPE_LABELS[vehicle.type]`
- **Immatriculation** : fonte `font-mono`
- **Marque / Modèle** : `brand model` + `year` en sous-label gris
- **Statut** : `VehicleStatusBadge` (5 couleurs)
- **Carburant** : barre de progression colorée si `fuelLevel` défini (vert ≥50%, orange ≥20%, rouge <20%), sinon `—`
- **Actions** : `<Edit3>` (éditer) + `<RefreshCw>` (changer statut) + `<Trash2>` (supprimer)

**Permissions actions :**
- `Edit3` + `RefreshCw` → `Permission.VEHICLES_UPDATE`
- `Trash2` → `Permission.VEHICLES_DELETE`

**Skeleton** : 5 `SkeletonRow` (7 colonnes) pendant le chargement

**Composants internes :**
- `VehicleStatusBadge` : 5 couleurs (disponible=vert, en_location=bleu, en_maintenance=orange, hors_service=rouge, vole=violet)
- `StatsCards` : 4 cartes avec dot coloré + skeleton individuel
- `VehicleFormFields` : formulaire partagé (10 champs, `readOnlyRegistration` pour l'édition)
- `CreateModal` : modal création avec validation complète client-side
- `EditModal` : modal édition pré-remplie avec immatriculation en lecture seule affichée en bandeau
- `StatusModal` : petite modale "Changer le statut" avec select toutes options + bouton "Mettre à jour"
- `DeleteDialog` : dialog confirmation avec avertissement amber + bouton rouge

**Constantes :**
- `TYPE_LABELS: Record<VehicleType, string>` — labels français des types d'engins
- `STATUS_LABELS: Record<VehicleStatus, string>` — labels français des statuts
- `STATUS_BADGE_CONFIG: Record<VehicleStatus, { label, className }>` — configuration des badges

**Validation formulaire (`validateVehicleForm`) :**
- `name`, `internalCode`, `registrationNumber`, `type`, `brand`, `model` : requis non vides
- `year` : nombre entier entre 1990 et 2030
- `serialNumber`, `trackerId`, `notes` : optionnels

### Résultat validation TypeScript
```
npx tsc --noEmit → ✅ 0 erreur
```
(correction mineure : `user` destructuré mais non utilisé dans `VehiclesPage` → remplacé par `hasPermission` uniquement)

### Décisions techniques
- `fetchVehicles` est une fonction locale (non `useCallback`) pour simplifier le debounce via `useRef`
- Les stats sont rechargées après chaque mutation (création/statut/suppression) via `void vehiclesService.getStats().then(setStats).catch(() => undefined)` pour garder les cartes à jour sans rechargement complet
- La barre de carburant est colorée dynamiquement selon le niveau (vert/orange/rouge) pour un retour visuel immédiat
- `readOnlyRegistration` prop dans `VehicleFormFields` permet de réutiliser le même formulaire en création et en édition (l'immatriculation est de plus affichée en bandeau lecture seule dans `EditModal`)
- `font-mono` sur l'immatriculation pour une meilleure lisibilité des plaques
- Les stats sont chargées séparément de la liste (endpoint `GET /vehicles/stats`) avec leur propre état `statsLoading`

### Tests à écrire (pour QA Agent)
- Non authentifié : redirection vers `/login`
- Sans permission `VEHICLES_READ` : mur "Accès refusé" visible
- Chargement : 5 skeleton rows `animate-pulse` s'affichent
- Stats cards : valeurs correctes par statut, skeleton pendant `statsLoading`
- Tableau rempli : 7 colonnes correctes (nom/code, type label FR, immatriculation mono, marque+modèle+année, badge statut, barre carburant, actions)
- Barre carburant : verte si ≥50%, orange si 20-49%, rouge si <20%, `—` si `fuelLevel` absent
- Filtre search : debounce 300ms, reset page à 1
- Filtre type : select filtre correctement, reset page à 1
- Filtre statut : select filtre correctement, reset page à 1
- Bouton "Ajouter un engin" absent si pas `VEHICLES_CREATE`
- Boutons Edit/Statut absents si pas `VEHICLES_UPDATE`
- Bouton Supprimer absent si pas `VEHICLES_DELETE`
- Modal création : validation (nom requis, code requis, immat requise, type requis, marque requise, modèle requis, année 1990-2030)
- Modal création : soumission OK → nouvel engin en tête de liste + stats rechargées
- Modal édition : formulaire pré-rempli, immatriculation en bandeau lecture seule
- Modal édition : soumission OK → ligne mise à jour dans le tableau
- StatusModal : select pré-sélectionné sur le statut actuel ; "Mettre à jour" PATCH `/vehicles/:id/status` → badge mis à jour + stats rechargées
- DeleteDialog : avertissement amber visible ; confirmation → engin retiré de la liste + stats rechargées
- Pagination : Précédent/Suivant désactivés aux limites
- Bouton rafraîchir : `animate-spin` pendant le chargement
- Erreur API liste : message rouge + bouton "Réessayer"

---

---

## [2026-03-16] — Frontend Agent — Navigation UserMenu + routes vehicles/clients/contracts

### Tâche
Ajouter une section "Navigation" dans le dropdown `UserMenu` (liens conditionnels selon permissions/rôle)
et câbler les routes `/vehicles`, `/clients`, `/contracts` dans le router React.

### Fichiers créés / modifiés

#### 1. `frontend/src/components/UserMenu.tsx` — MODIFIÉ
- Import ajouté : `Truck`, `Users`, `FileText`, `UserCog` depuis `lucide-react`
- Import ajouté : `Permission` depuis `@/types`
- Section "Navigation" insérée entre le bloc profil/settings et le bouton Déconnexion :
  - Rendue conditionnellement : visible si l'utilisateur a au moins une permission parmi `vehicles:read`, `clients:read`, `contracts:read`, **ou** est `admin`/`super_admin`
  - Lien `/vehicles` → icône `Truck` — conditionnel sur `Permission.VEHICLES_READ`
  - Lien `/clients` → icône `Users` — conditionnel sur `Permission.CLIENTS_READ`
  - Lien `/contracts` → icône `FileText` — conditionnel sur `Permission.CONTRACTS_READ`
  - Lien `/users` → icône `UserCog` — conditionnel sur `role === 'admin' || 'super_admin'`
  - Chaque lien appelle `setIsOpen(false)` au clic
  - Label "Navigation" en `text-xs font-semibold text-gray-400 uppercase tracking-wider`
  - Style liens identique aux liens profil/settings : `flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100`

#### 2. `frontend/src/App.tsx` — MODIFIÉ
- Imports ajoutés : `VehiclesPage`, `ClientsPage`, `ContractsPage` depuis `@/pages`
- Routes ajoutées (toutes dans `<ProtectedRoute>`) :
  - `<Route path="/vehicles" … />`
  - `<Route path="/clients" … />`
  - `<Route path="/contracts" … />`

#### 3. `frontend/src/pages/index.ts` — MODIFIÉ
- Ajout des exports :
  - `export { VehiclesPage } from './VehiclesPage';`
  - `export { ClientsPage } from './ClientsPage';`
  - `export { ContractsPage } from './ContractsPage';`

#### 4. `frontend/src/pages/VehiclesPage.tsx` — CRÉÉ (stub)
Page stub avec header FleetBTP + UserMenu + placeholder centré (icône `Truck`).
Protection `useEffect` → redirect `/login` si `!isAuthenticated`.

#### 5. `frontend/src/pages/ClientsPage.tsx` — CRÉÉ (stub)
Page stub avec header FleetBTP + UserMenu + placeholder centré (icône `Users`).
Protection `useEffect` → redirect `/login` si `!isAuthenticated`.

#### 6. `frontend/src/pages/ContractsPage.tsx` — CRÉÉ (stub)
Page stub avec header FleetBTP + UserMenu + placeholder centré (icône `FileText`).
Protection `useEffect` → redirect `/login` si `!isAuthenticated`.

### Résultat validation TypeScript
```
npx tsc --noEmit → ✅ 0 erreur
```

### Décisions techniques
- La section "Navigation" est enveloppée dans un `&&` sur l'union des conditions pour éviter un `<div>` vide (séparateur) quand aucun lien n'est visible (ex: opérateur sans permissions)
- Les stubs de pages partagent le même header que `DashboardPage` (logo + `UserMenu`) pour cohérence visuelle dès le premier rendu
- `UserRole` enum n'est pas utilisé directement dans `UserMenu` car `user.role` est de type `UserRole` (enum string) ; la comparaison `=== 'admin'` reste valide grâce au fait que `UserRole.ADMIN = 'admin'` (string enum)
- La garde `/users` reste inchangée dans le router (pas de `requireRole` côté route ; la page gère son propre mur d'accès)

### Tests à écrire (pour QA Agent)
- UserMenu — opérateur sans permissions : la section "Navigation" est absente
- UserMenu — manager avec `vehicles:read` + `clients:read` : Véhicules et Clients visibles, Contrats absent, Utilisateurs absent
- UserMenu — admin : tous les liens visibles (vehicles:read, clients:read, contracts:read inclus dans DEFAULT_PERMISSIONS admin) + lien Utilisateurs
- UserMenu — clic sur un lien navigation : menu se ferme (`isOpen = false`)
- Router — `GET /vehicles` non authentifié : redirection vers `/login` via `ProtectedRoute`
- Router — `GET /clients` authentifié : `ClientsPage` rendue
- Router — `GET /contracts` authentifié : `ContractsPage` rendue

---

---

## [2026-03-16] — Backend Agent — Gestion des contrats (CRUD)

### Tâche
Implémenter la gestion complète des contrats de location d'engins BTP (CRUD) côté backend.
Endpoints : `GET|POST|PATCH|DELETE /api/contracts/...`

### Fichiers créés / modifiés

#### 1. `backend/src/services/ContractService.ts` — CRÉÉ
Service de gestion des contrats (couche métier) :

**Interfaces exportées :**
- `ContractFilters` : filtres de liste (`status`, `clientId`, `vehicleId`, `page`, `limit`)
- `CreateContractData` : payload de création
- `UpdateContractData` : payload de mise à jour partielle (`Partial<Omit<CreateContractData, 'clientId' | 'vehicleId'>> & { status? }`)

**Erreurs métier exportées (classes typées avec `code` discriminant) :**
- `ContractNotFoundError` (code: `CONTRACT_NOT_FOUND`) → HTTP 404
- `ContractConflictError` (code: `CONFLICT`) → HTTP 409
- `ContractValidationError` (code: `VALIDATION_ERROR`) → HTTP 400

**Méthodes publiques :**
- `listContracts(orgId, filters)` — filtre par `status`/`clientId`/`vehicleId`, pagination `page`/`limit` (max 100), populate `clientId (companyName, contactName)` et `vehicleId (name, registrationNumber, type)`
- `getContractById(orgId, contractId)` — scoped organisation + populate ; lance `ContractNotFoundError` si absent ou hors scope
- `createContract(orgId, data)` — vérifie que `clientId` et `vehicleId` appartiennent à l'org ; vérifie l'absence de chevauchement de dates avec un contrat ACTIF existant pour le même véhicule
- `updateContract(orgId, contractId, data)` — si passage à `ACTIF` : re-vérifie le chevauchement ; si `ANNULE` ou `TERMINE` : libère le véhicule (status → `DISPONIBLE`) s'il n'a plus d'autre contrat actif
- `deleteContract(orgId, contractId)` — seulement si `status = BROUILLON | ANNULE`, sinon `ContractConflictError`

**Méthodes privées :**
- `_checkVehicleOverlap(vehicleId, startDate, endDate, excludeContractId)` — requête MongoDB avec `$lt`/`$gt` pour détecter les chevauchements de période sur les contrats `ACTIF`
- `_releaseVehicleIfFree(vehicleId, excludeContractId)` — compte les contrats `ACTIF` restants ; si 0 → `Vehicle.findByIdAndUpdate(status: DISPONIBLE)`

#### 2. `backend/src/controllers/ContractController.ts` — CRÉÉ
Contrôleur avec validation Zod et mapping des erreurs service → codes HTTP :

**Schémas Zod (définis dans le fichier) :**
- `GeoPointSchema` — `{ type: 'Point', coordinates: [lng(-180..180), lat(-90..90)] }`
- `CreateContractSchema` — clientId (ObjectId regex), vehicleId, startDate, endDate, dailyRate (≥0), deposit?, deliveryLocation (GeoPoint), deliveryAddress, geofenceId?, notes (max 2000)
- `UpdateContractSchema` — tous champs optionnels ; incluant `status` (nativeEnum ContractStatus)
- `ListContractsQuerySchema` — status?, clientId?, vehicleId?, page (coerce, défaut 1), limit (coerce, défaut 20, max 100)

**Méthodes (pattern `async method(req, res, next)`) :**
- `list` → 200 + meta pagination (`page`, `limit`, `total`, `totalPages`)
- `getOne` → 200 ou 404
- `create` → 201 ; `organizationId` toujours depuis `req.user.organizationId`
- `update` → 200 ou 400/404/409
- `remove` → 200 ou 404/409

**Helper `handleServiceError`** : dispatch sur `ContractNotFoundError` (404), `ContractConflictError` (409), `ContractValidationError` (400) avant `next(error)` pour les erreurs inattendues.

#### 3. `backend/src/routes/contracts.ts` — CRÉÉ
```
router.use(authenticate)
GET    /          requirePermission(CONTRACTS_READ)   → controller.list
GET    /:id       requirePermission(CONTRACTS_READ)   → controller.getOne
POST   /          requirePermission(CONTRACTS_CREATE) → controller.create
PATCH  /:id       requirePermission(CONTRACTS_UPDATE) → controller.update
DELETE /:id       requirePermission(CONTRACTS_DELETE) → controller.remove
```

#### 4. `backend/src/routes/index.ts` — MODIFIÉ
Ajout de `import contractRoutes from './contracts.js'` et `router.use('/contracts', contractRoutes)`.

#### 5. `backend/src/controllers/index.ts` — MODIFIÉ
Ajout de `export { ContractController, contractController } from './ContractController.js'`.

#### 6. `backend/src/services/index.ts` — MODIFIÉ
Ajout des exports : `ContractService`, `contractService`, `ContractFilters`, `CreateContractData`, `UpdateContractData`, `ContractNotFoundError`, `ContractConflictError`, `ContractValidationError`.

### Résultat validation TypeScript
```
npx tsc --noEmit → ✅ 0 erreur
```

### Règles métier implémentées
- Scoping organisation : toutes les requêtes filtrent sur `req.user.organizationId`
- `organizationId` jamais lu du body (POST /contracts)
- Vérification appartenance client + véhicule à l'organisation avant création
- Détection de chevauchement de dates via requête MongoDB (`startDate: { $lt: endDate }, endDate: { $gt: startDate }`) sur les contrats `ACTIF`
- Re-vérification chevauchement lors du passage au statut `ACTIF`
- Libération automatique du véhicule (status → `DISPONIBLE`) si plus aucun contrat `ACTIF`
- Suppression uniquement autorisée pour les statuts `BROUILLON` ou `ANNULE`
- `totalAmount` calculé automatiquement par le `pre-save` du modèle (`dailyRate × durationDays`)
- `contractNumber` généré automatiquement (`CTR-YYYYMM-RANDOM`) par le `pre-save` du modèle

### Tests à écrire (pour QA Agent)
- `GET /api/contracts` : liste scoped à l'org, pagination, filtres status/clientId/vehicleId
- `GET /api/contracts/:id` : 200 si trouvé dans l'org, 404 sinon ou ObjectId invalide
- `POST /api/contracts` : 201 + ignore `organizationId` du body, 400 si Zod échoue (endDate ≤ startDate, coordonnées hors bornes), 409 si clientId/vehicleId hors scope ou chevauchement de dates
- `PATCH /api/contracts/:id` : 400 si validation échoue, 409 si chevauchement lors du passage à ACTIF, 200 sinon ; véhicule libéré si passage à ANNULE/TERMINE
- `DELETE /api/contracts/:id` : 200 si BROUILLON/ANNULE, 409 si ACTIF/TERMINE
- Vérifier qu'un OPERATOR (pas `contracts:create`) reçoit 403 sur `POST /api/contracts`
- Vérifier que `totalAmount` est bien calculé = dailyRate × durationDays
- Vérifier que `contractNumber` est auto-généré et unique

---


## [2026-03-16] — Backend Agent — Gestion des utilisateurs (CRUD)

### Tâche
Implémenter la gestion complète des utilisateurs (CRUD) côté backend.
Endpoints : `GET|POST|PATCH|DELETE /api/users/...`

### Fichiers créés / modifiés

#### 1. `backend/src/services/UserService.ts` — CRÉÉ
Service de gestion des utilisateurs (couche métier) :

**Interfaces exportées :**
- `UserFilters` : filtres de liste (`role`, `isActive`, `search`, `page`, `limit`)
- `CreateUserData` : payload de création
- `UpdateUserData` : payload de mise à jour partielle

**Erreurs métier exportées (classes typées avec `code` discriminant) :**
- `UserNotFoundError` (code: `USER_NOT_FOUND`) → HTTP 404
- `UserForbiddenError` (code: `FORBIDDEN`) → HTTP 403
- `UserConflictError` (code: `CONFLICT`) → HTTP 409

**Méthodes publiques :**
- `listUsers(orgId, filters)` — filtre `isActive=true` par défaut, recherche regex sur `firstName`/`lastName`/`email`, pagination `page`/`limit` (max 100)
- `getUserById(orgId, userId)` — scoped à l'organisation ; lance `UserNotFoundError` si absent
- `createUser(orgId, data)` — vérifie unicité email, applique `DEFAULT_PERMISSIONS` si aucune permission fournie, `organizationId` jamais du body
- `updateUser(orgId, userId, data, requestingUserId)` — interdit l'auto-modification du rôle ; recalcule les permissions par défaut si rôle changé ; vérifie unicité email si modifié
- `deactivateUser(orgId, userId, requestingUserId)` — soft delete (`isActive = false`) ; interdit l'auto-désactivation
- `updatePermissions(orgId, userId, permissions)` — remplace intégralement la liste des permissions

#### 2. `backend/src/controllers/UserController.ts` — CRÉÉ
Contrôleur avec validation Zod et mapping des erreurs service → codes HTTP :

**Schémas Zod (définis dans le fichier) :**
- `CreateUserSchema` — email, password (min 8), firstName, lastName, role?, permissions?
- `UpdateUserSchema` — tous champs optionnels ; firstName/lastName/email/role/isActive
- `UpdatePermissionsSchema` — tableau de `Permission` (nativeEnum)
- `ListUsersQuerySchema` — role?, isActive (coerce string→boolean, défaut `true`), search?, page (défaut 1), limit (défaut 20, max 100)

**Méthodes (pattern `async method(req, res, next)`) :**
- `list` → 200 + meta pagination
- `getOne` → 200 ou 404
- `create` → 201 ; `organizationId` toujours depuis `req.user.organizationId`
- `update` → 200 ou 403/404/409
- `remove` → 200 (soft delete)
- `updatePermissions` → 200

**Helper `handleServiceError`** : dispatch sur les erreurs métier avant de `next(error)` pour les erreurs inattendues.

#### 3. `backend/src/routes/users.ts` — CRÉÉ
```
router.use(authenticate)
GET    /          requirePermission(USERS_READ)   → controller.list
GET    /:id        requirePermission(USERS_READ)   → controller.getOne
POST   /          requirePermission(USERS_CREATE) → controller.create
PATCH  /:id        requirePermission(USERS_UPDATE) → controller.update
DELETE /:id        requirePermission(USERS_DELETE) → controller.remove
PATCH  /:id/permissions requirePermission(USERS_UPDATE) → controller.updatePermissions
```

#### 4. `backend/src/routes/index.ts` — MODIFIÉ
Ajout de `import userRoutes from './users.js'` et `router.use('/users', userRoutes)`.

#### 5. `backend/src/controllers/index.ts` — MODIFIÉ
Ajout de `export { UserController, userController } from './UserController.js'`.

#### 6. `backend/src/services/index.ts` — MODIFIÉ
Ajout des exports : `UserService`, `userService`, `UserFilters`, `CreateUserData`, `UpdateUserData`, `UserNotFoundError`, `UserForbiddenError`, `UserConflictError`.

### Résultat validation TypeScript
```
npx tsc --noEmit → ✅ 0 erreur
```

### Règles métier implémentées
- Scoping organisation : toutes les requêtes filtrent sur `req.user.organizationId`
- `organizationId` jamais lu du body (POST /users)
- Role par défaut : `operator`
- Soft delete uniquement (`isActive = false`)
- Auto-modification du rôle interdite (403)
- Auto-désactivation interdite (403)
- Permissions recalculées automatiquement lors d'un changement de rôle (si `updateUser`)
- Unicité email vérifiée en création ET en mise à jour

### Tests à écrire (pour QA Agent)
- `GET /api/users` : liste scoped à l'org, pagination, filtres role/isActive/search
- `GET /api/users/:id` : 200 si trouvé dans l'org, 404 sinon
- `POST /api/users` : 201 + ignore `organizationId` du body, 409 si email dupliqué, 400 si validation Zod échoue
- `PATCH /api/users/:id` : 403 si l'utilisateur modifie son propre rôle, 409 si email existe déjà
- `DELETE /api/users/:id` : `isActive = false` en base, 403 si auto-désactivation
- `PATCH /api/users/:id/permissions` : remplace les permissions, 400 si permission inconnue
- Vérifier qu'un OPERATOR (pas `users:create`) reçoit 403 sur `POST /api/users`

---

## [2026-03-16] — Backend Agent — Auto-inscription avec création automatique d'organisation

### Tâche
Implémenter le flux d'auto-inscription publique sur `POST /api/auth/register` :
quand un utilisateur s'inscrit sans `organizationId`, une nouvelle organisation est
créée automatiquement et il en devient ADMIN.

### Fichiers modifiés

#### 1. `backend/src/models/Organization.ts` — CRÉÉ
Nouveau modèle Mongoose minimal pour les organisations :
- Champs : `name` (String, required), `slug` (String, unique, auto-généré), `isActive` (Boolean, default: true), `createdAt`, `updatedAt` (timestamps)
- Middleware `pre('validate')` : génère automatiquement le `slug` depuis le `name` avec gestion des accents et des collisions (suffixe `_id` slice)
- Export nommé : `Organization`, `IOrganizationDocument`

#### 2. `backend/src/models/index.ts` — MODIFIÉ
Ajout de l'export `Organization` et `IOrganizationDocument` en première ligne (avant Vehicle).

#### 3. `backend/src/services/AuthService.ts` — MODIFIÉ
- Import ajouté : `Organization` depuis `../models/Organization.js`
- `RegisterData.organizationId` passé de `string` (requis) à `string | undefined` (optionnel)
- Méthode `register()` : ajout de la logique de résolution de l'`organizationId`
  - Si `data.organizationId` présent → `new Types.ObjectId(data.organizationId)` (comportement inchangé)
  - Si absent → `Organization.create({ name: "${firstName} ${lastName} - Organisation" })` puis utilisation du `_id`

#### 4. `backend/src/controllers/AuthController.ts` — MODIFIÉ
- Méthode `register()` : logique de rôle revue en 3 cas :
  1. `req.user` absent (inscription publique) → `UserRole.ADMIN`
  2. `req.user` présent + role ADMIN/SUPER_ADMIN → `role` du body (ou OPERATOR par défaut)
  3. Autres utilisateurs connectés → `UserRole.OPERATOR` (pas d'élévation de privilège)
- Résolution de `organizationId` : body > organisation du user connecté > undefined (AuthService crée)

### Décisions techniques
- Le slug est généré côté `pre('validate')` plutôt que `pre('save')` pour garantir sa présence dès la validation Mongoose
- En cas de collision de slug (deux utilisateurs avec le même nom), on suffixe avec les 6 derniers caractères de l'`_id` (suffisamment unique en pratique)
- `organizationId` reste `required: true` dans le schéma User — c'est `AuthService` qui garantit qu'il est toujours résolu avant la création
- La route `POST /api/auth/register` (middleware `optionalAuth`) n'a pas été touchée

### Tests à écrire (pour QA Agent)
- `POST /api/auth/register` sans `organizationId` : vérifie création org + rôle ADMIN
- `POST /api/auth/register` avec `organizationId` valide (admin connecté) : rôle du body respecté
- Deux inscriptions avec le même prénom/nom : les slugs doivent être différents
- Email déjà existant → 409/400

---

## [2026-03-16] — Frontend Agent — Création de ProfilePage

### Tâche
Générer la page de profil utilisateur (`/profile`) pour le frontend SaaS BTP.
Stack : React 18 + TypeScript + Vite + Tailwind CSS + Zustand.

### Fichiers créés / modifiés

#### 1. `frontend/src/pages/ProfilePage.tsx` — CRÉÉ
Page complète de gestion du profil utilisateur. Structure :

**Header** identique à `DashboardPage` (logo Truck + bg-white shadow-sm + UserMenu)

**Mise en page** : grille `lg:grid-cols-4`
- Colonne gauche (1/4) : carte d'identité avec avatar initiales, nom complet, badge rôle coloré, email, date d'inscription
- Colonne droite (3/4) : navigation par onglets + contenu

**Onglet "Informations"** (`TabInfos`)
- Mode lecture par défaut (champs affichés en `bg-gray-50`, bouton "Modifier" avec icône `Edit3`)
- Mode édition : inputs prénom / nom / email, boutons "Enregistrer" / "Annuler"
- Soumission : `authService.updateProfile()` → `useAuthStore.getState().refreshUser()`
- Bannière verte 3 secondes après succès ; erreur rouge en cas d'échec API
- Bloc read-only "Informations de compte" : rôle (badge coloré), date de création, dernière connexion, ID organisation

**Onglet "Sécurité"** (`TabSecurity`)
- Sous-section changement de mot de passe :
  - 3 champs avec boutons Eye/EyeOff individuels (composant `PasswordField`)
  - Validation client : regex `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/` + correspondance des deux nouveaux MDP
  - Indicateur de force (3 barres, même logique que `RegisterPage`)
  - Soumission : `authService.changePassword()` ; succès vert 3 s puis reset du formulaire
- Sous-section permissions :
  - Permissions groupées par catégorie (Véhicules, Geofences, Alertes, Clients, Contrats, Utilisateurs, Organisation)
  - Affichage en pills verts avec icône `Check` et libellé français (via `PERMISSION_LABELS`)
  - Titre de catégorie avec compteur ; catégories vides masquées

**Composants internes**
- `PasswordStrengthIndicator` : 3 barres rouge/orange/vert + label
- `PasswordField` : champ mot de passe générique avec toggle visibilité, gestion erreur et force

**Règles respectées**
- TypeScript strict — aucun `any`
- Export nommé `export function ProfilePage()`
- Protection côté composant : `useEffect` → redirect `/login` si `!isAuthenticated`
- Tailwind CSS uniquement (pas de CSS inline)
- Appels API directs via `authService`, synchronisation store via `useAuthStore.getState().refreshUser()`

#### 2. `frontend/src/pages/index.ts` — MODIFIÉ
Ajout de l'export `ProfilePage` en dernière ligne.

### Décisions techniques
- Les sous-composants `TabInfos` et `TabSecurity` sont définis dans le même fichier pour limiter la prolifération de fichiers (colocalisés, non réutilisés ailleurs)
- Le composant `PasswordField` est générique et réutilisable au sein du fichier
- La protection (`!isAuthenticated → navigate('/login')`) est doublée par le `ProtectedRoute` éventuel dans le router ; ici, c'est une sécurité de second niveau
- `formatDateFR` affiche `day: 'numeric', month: 'long', year: 'numeric'` pour un rendu lisible en français
- La navigation par onglets utilise les attributs ARIA (`role="tablist"`, `aria-selected`) pour l'accessibilité

### Tests à écrire (pour QA Agent)
- Rendu en mode lecture : les 3 champs sont en lecture seule, le bouton "Modifier" est visible
- Clic "Modifier" : les champs deviennent des inputs pré-remplis avec les données du store
- Soumission réussie : bannière verte apparaît 3 s puis disparaît ; mode édition se ferme
- Soumission échouée (API) : message rouge sous le formulaire, le formulaire reste ouvert
- Changement de mot de passe : validation regex, mismatch, indicateur de force, reset après succès
- Permissions : groupement correct, pills affichés, catégories vides masquées
- Non authentifié : redirection vers `/login`

---

## [2026-03-16] — Frontend Agent — Création de SettingsPage

### Tâche
Générer la page de paramètres (`/settings`) pour le frontend SaaS BTP.
Stack : React 18 + TypeScript + Vite + Tailwind CSS + Zustand.

### Fichiers créés / modifiés

#### 1. `frontend/src/pages/SettingsPage.tsx` — CRÉÉ
Page complète de gestion des paramètres. Structure :

**Header** identique à `DashboardPage` (logo Truck + bg-white shadow-sm + UserMenu)
Sous-titre : "Paramètres & configuration"

**Navigation par onglets** (pill/underline, 3 onglets) avec état `TabId = 0 | 1 | 2`
- Onglet 0 : icône `Building2` + "Organisation"
- Onglet 1 : icône `Bell` + "Notifications"
- Onglet 2 : icône `Shield` + "Sécurité"

**Onglet 0 — TabOrganisation**
- Mode lecture : affichage nom org, identifiant organisation (`user?.organizationId`), plan "Plan Starter" (badge blue)
- Bouton "Modifier" visible uniquement si `user?.role === 'admin' || 'super_admin'` ; message amber si non admin
- Mode édition : input contrôlé + boutons "Enregistrer" / "Annuler"
- `handleSaveOrg` : setTimeout 500 ms → bannière verte 3 s via `SuccessBanner`
- Statistiques : 3 cartes en `grid-cols-3` (Membres/Véhicules/Contrats actifs) avec icônes `Users`, `Truck`, `FileText`

**Onglet 1 — TabNotifications**
- État `NotifPrefs` : 5 booléens (`criticalAlerts`, `geofenceAlerts`, `batteryLow`, `newContracts`, `vehicleUpdates`)
- Tableau constant `NOTIF_ROWS` décrivant label/description pour chaque préférence
- Toggle pill animé (h-6 w-11, translate-x-6/1) par préférence
- Bouton "Enregistrer les préférences" → bannière verte 3 s

**Onglet 2 — TabSecurity**
- Section "Sessions actives" : tableau avec 3 fausses sessions ; session courante = badge vert, autres = bouton "Révoquer" (window.alert)
- Section "Authentification à deux facteurs" : badge "Non configuré" + bouton désactivé
- Section "Journaux d'audit" : bloc `bg-gray-50` avec icône `Lock`, texte "Disponible dans la version Pro" + badge purple "Pro"

**Composant interne**
- `SuccessBanner` : bannière verte réutilisable (utilisée dans onglet 0 et onglet 1)

**Protection**
- `useEffect` → `navigate('/login')` si `!isAuthenticated`

**Règles respectées**
- TypeScript strict — aucun `any` ; type discriminant `TabId = 0 | 1 | 2`
- Export nommé `export function SettingsPage()`
- Tailwind CSS uniquement (pas de CSS inline)
- Imports via alias `@/`

#### 2. `frontend/src/pages/index.ts` — MODIFIÉ
Ajout de `export { SettingsPage } from './SettingsPage';` en dernière ligne.

#### 3. `frontend/src/App.tsx` — MODIFIÉ
- `SettingsPage` ajouté dans les imports depuis `@/pages`
- Route `/settings` ajoutée après `/profile` avec `ProtectedRoute`

### Résultat validation TypeScript
```
npx tsc --noEmit → ✅ 0 erreur
```

### Tests à écrire (pour QA Agent)
- Onglet Organisation (admin) : le bouton "Modifier" est visible ; clic passe en mode édition ; enregistrement affiche bannière verte 3 s
- Onglet Organisation (non admin) : le bouton "Modifier" est absent ; message amber visible
- Onglet Organisation : les 3 cartes statistiques s'affichent correctement
- Onglet Notifications : chaque toggle alterne l'état booléen ; "Enregistrer" affiche bannière verte 3 s
- Onglet Sécurité : tableau 3 sessions ; badge vert sur session courante ; clic "Révoquer" déclenche window.alert
- Onglet Sécurité : bouton 2FA est `disabled` (cursor-not-allowed)
- Onglet Sécurité : bloc "Journaux d'audit" affiche badge "Pro"
- Navigation onglets : clic change l'onglet actif (classe border-blue-600 vs border-transparent)
- Non authentifié : redirection vers `/login`

---

## [2026-03-16] — Frontend Agent — Création de UsersPage

### Tâche
Générer la page de gestion des utilisateurs (`/users`) pour le frontend SaaS BTP.
Stack : React 18 + TypeScript + Vite + Tailwind CSS + Zustand.
Accessible uniquement aux rôles `admin` et `super_admin`.

### Fichiers créés / modifiés

#### 1. `frontend/src/services/users.ts` — CRÉÉ
Service de gestion des utilisateurs (couche API) :

**Interfaces exportées :**
- `UserItem` : entité utilisateur renvoyée par l'API
- `CreateUserPayload` : payload de création (email, password, firstName, lastName, role)
- `UpdateUserPayload` : payload de mise à jour partielle (tous champs optionnels)
- `UsersListResponse` : réponse paginée (users, total, page, limit, totalPages)

**Classe `UsersService` avec méthodes :**
- `listUsers(params?)` — GET `/users` avec filtres search/role/page/limit
- `createUser(payload)` — POST `/users` → 201
- `updateUser(id, payload)` — PATCH `/users/:id`
- `deactivateUser(id)` — DELETE `/users/:id` (soft delete)

**Dépendance :** utilise les méthodes génériques `api.get/post/patch/delete` ajoutées à `ApiClient`

#### 2. `frontend/src/services/api.ts` — MODIFIÉ
Ajout de 4 méthodes HTTP génériques à la classe `ApiClient` :
- `get<T>(url, config?)` → `{ data: T }`
- `post<T>(url, body?)` → `{ data: T }`
- `patch<T>(url, body?)` → `{ data: T }`
- `delete<T>(url)` → `{ data: T }`

Ces méthodes délèguent à `this.client` (AxiosInstance) avec tous les intercepteurs déjà configurés (Authorization Bearer, X-Organization-Id, retry 401).

#### 3. `frontend/src/services/index.ts` — MODIFIÉ
Ajout des exports :
```ts
export { usersService } from './users';
export type { UserItem, CreateUserPayload, UpdateUserPayload, UsersListResponse } from './users';
```

#### 4. `frontend/src/pages/UsersPage.tsx` — CRÉÉ
Page complète de gestion des utilisateurs. Structure :

**Header** identique à `DashboardPage` (logo Truck + bg-white shadow-sm + UserMenu)
Sous-titre : "Gestion des utilisateurs"

**Protection double :**
- `useEffect` → `navigate('/login')` si `!isAuthenticated`
- Mur d'accès refusé affiché si `user?.role !== 'admin' && user?.role !== 'super_admin'`

**États locaux :**
- `users`, `total`, `isLoading`, `search`, `filterRole`, `page`, `totalPages`, `error`
- `showCreateModal`, `editingUser`, `deactivatingUser`

**`fetchUsers`** avec debounce 300 ms sur `search` via `useRef<ReturnType<typeof setTimeout>>`
Déclenché à chaque changement de `search`, `filterRole`, `page`.

**Barre d'actions :**
- Titre "Membres de l'organisation" + compteur pluralisé
- Bouton "Inviter un utilisateur" (icône `UserPlus`) visible si admin/super_admin

**Filtres :**
- Input recherche avec icône `Search` (absolute + pl-9)
- Select rôle : tous / admin / manager / operator

**Tableau colonnes :** Utilisateur | Rôle | Statut | Dernière connexion | Actions
- Avatar initiales `bg-blue-600 text-white` + fullName (+ badge "(vous)" si isSelf) + email
- `RoleBadge` : super_admin=violet, admin=bleu, manager=vert, operator=gris
- `StatusBadge` : Actif=vert, Inactif=rouge
- `formatDateFR` pour la dernière connexion (renvoie "Jamais" si absent)
- Bouton `Edit3` → `setEditingUser(u)` (si admin ET pas soi-même)
- Bouton `UserX` rouge → `setDeactivatingUser(u)` (si admin ET pas soi-même ET isActive)

**Skeleton :** 3 `SkeletonRow` avec `animate-pulse bg-gray-100` pendant le chargement

**Pagination :** Précédent / "Page X sur Y" / Suivant, visible si `totalPages > 1`

**Composants internes :**
- `RoleBadge` : badge coloré selon le rôle
- `StatusBadge` : badge vert/rouge selon `isActive`
- `SkeletonRow` : ligne skeleton pour état de chargement
- `CreateModal` : formulaire création (prénom, nom, email, password + toggle Eye/EyeOff, rôle select)
  - Validation client : champs requis, email regex, password ≥ 8 chars
  - `isSubmitting` avec `Loader2 animate-spin`
  - Erreur API affichée dans le modal
- `EditModal` : formulaire édition pré-rempli (prénom, nom, email, rôle, checkbox isActive)
  - Même structure que `CreateModal` mais sans password
- `DeactivateDialog` : dialog de confirmation avec texte explicatif et bouton "Désactiver" rouge

**Helpers :**
- `formatDateFR(dateStr?)` : affichage FR ou "Jamais"
- `getInitials(firstName, lastName)` : 2 premières lettres en majuscules

#### 5. `frontend/src/pages/index.ts` — MODIFIÉ
Ajout de `export { UsersPage } from './UsersPage';` en dernière ligne.

#### 6. `frontend/src/App.tsx` — MODIFIÉ
- `UsersPage` ajouté dans les imports depuis `@/pages`
- Route `/users` ajoutée après `/settings` avec `ProtectedRoute`

### Résultat validation TypeScript
```
npx tsc --noEmit → ✅ 0 erreur
```

### Décisions techniques
- Les méthodes génériques `get/post/patch/delete` sont ajoutées à `ApiClient` (plutôt que de créer une 2e instance axios) pour réutiliser les intercepteurs d'authentification et de refresh token existants
- Le debounce 300 ms est implémenté avec `useRef<ReturnType<typeof setTimeout>>` (TypeScript strict, pas de `any`)
- La protection d'accès est en deux niveaux : redirect `/login` si non authentifié, mur "Accès refusé" si rôle insuffisant
- `void fetchUsers()` utilisé pour éviter les warnings de promesse flottante dans `useEffect` et les handlers d'erreur
- Les sous-composants modaux sont colocalisés dans le même fichier (non réutilisés ailleurs)
- `isSelf` détecté via `u._id === user?._id || u.id === user?.id` pour gérer les deux formats d'identifiant

### Tests à écrire (pour QA Agent)
- Non authentifié : redirection vers `/login`
- Rôle operator/manager : mur "Accès refusé" affiché, pas de tableau
- Rôle admin : tableau visible, bouton "Inviter un utilisateur" visible
- Chargement : 3 skeleton rows `animate-pulse` s'affichent
- Tableau rempli : colonnes Utilisateur/Rôle/Statut/Dernière connexion/Actions correctes
- Utilisateur courant (isSelf) : badge "(vous)" visible, pas de boutons Edit/Désactiver
- Filtres : changement de `search` reset la page à 1, debounce 300 ms
- Filtre rôle : select filtre correctement
- Pagination : boutons Précédent/Suivant désactivés aux limites
- Modal création : validation (champs vides, email invalide, password < 8), soumission OK met à jour la liste
- Modal édition : formulaire pré-rempli, soumission OK met à jour la ligne dans le tableau
- Dialog désactivation : confirmation → `isActive = false` dans la liste, sans rechargement API
- Erreur API liste : message rouge affiché avec bouton "Réessayer"

---

## [2026-03-16] — Backend Agent — Gestion des clients (CRUD)

### Tâche
Implémenter la gestion complète des clients (CRUD) côté backend.
Endpoints : `GET|POST|PATCH|DELETE /api/clients/...`

### Fichiers créés / modifiés

#### 1. `backend/src/services/ClientService.ts` — CRÉÉ
Service de gestion des clients (couche métier) :

**Interfaces exportées :**
- `ClientFilters` : filtres de liste (`search`, `page`, `limit`)
- `CreateClientData` : payload de création (`companyName`, `contactName`, `email`, `phone`, `address`, `siret?`)
- `UpdateClientData` : `Partial<CreateClientData>`

**Erreurs métier exportées (classes typées avec `code` discriminant) :**
- `ClientNotFoundError` (code: `CLIENT_NOT_FOUND`) → HTTP 404
- `ClientConflictError` (code: `CONFLICT`) → HTTP 409

**Méthodes publiques :**
- `listClients(orgId, filters)` — recherche regex sur `companyName`/`contactName`/`email`, pagination `page`/`limit` (max 100), tri `createdAt: -1`
- `getClientById(orgId, clientId)` — scoped à l'organisation ; lance `ClientNotFoundError` si absent ou ObjectId invalide
- `createClient(orgId, data)` — vérifie unicité email au sein de l'organisation, `country` par défaut à `'France'`
- `updateClient(orgId, clientId, data)` — mise à jour champ par champ ; vérifie unicité email si modifié ; gestion partielle de l'adresse imbriquée
- `deleteClient(orgId, clientId)` — suppression physique (`deleteOne`) ; vérifie `Contract.findOne({ clientId, status: 'actif' })` avant suppression ; lève `ClientConflictError('Ce client possède des contrats actifs')` si trouvé

#### 2. `backend/src/controllers/ClientController.ts` — CRÉÉ
Contrôleur avec validation Zod et mapping des erreurs service → codes HTTP :

**Schémas Zod (définis dans le fichier) :**
- `CreateClientSchema` — companyName (min1, max200), contactName (min1), email, phone (regex FR), address (street, city, postalCode 5 chiffres, country default 'France'), siret (14 chiffres, optionnel)
- `UpdateClientSchema` — `CreateClientSchema.partial()`
- `ListClientsQuerySchema` — search?, page (coerce, défaut 1), limit (coerce, défaut 20, max 100)

**Méthodes (pattern `async method(req, res, next)`) :**
- `list` → 200 + meta pagination (page, limit, total, totalPages)
- `getOne` → 200 ou 404
- `create` → 201 ; `organizationId` toujours depuis `req.user.organizationId`
- `update` → 200 ou 404/409
- `remove` → 200 ou 404/409

**Helper `handleServiceError`** : dispatch `ClientNotFoundError` → 404, `ClientConflictError` → 409, sinon `next(error)`.

#### 3. `backend/src/routes/clients.ts` — CRÉÉ
```
router.use(authenticate)
GET    /          requirePermission(CLIENTS_READ)    → controller.list
GET    /:id       requirePermission(CLIENTS_READ)    → controller.getOne
POST   /          requirePermission(CLIENTS_CREATE)  → controller.create
PATCH  /:id       requirePermission(CLIENTS_UPDATE)  → controller.update
DELETE /:id       requirePermission(CLIENTS_DELETE)  → controller.remove
```
Binding via `.bind(controller)` (pas de lambda wrapper).

#### 4. `backend/src/routes/index.ts` — MODIFIÉ
Ajout de `import clientRoutes from './clients.js'` et `router.use('/clients', clientRoutes)`.

#### 5. `backend/src/controllers/index.ts` — MODIFIÉ
Ajout de `export { ClientController, clientController } from './ClientController.js'`.

#### 6. `backend/src/services/index.ts` — MODIFIÉ
Ajout des exports : `ClientService`, `clientService`, `ClientFilters`, `CreateClientData`, `UpdateClientData`, `ClientNotFoundError`, `ClientConflictError`.

### Résultat validation TypeScript
```
npx tsc --noEmit → ✅ 0 erreur
```

### Règles métier implémentées
- Scoping organisation : toutes les requêtes filtrent sur `req.user.organizationId`
- `organizationId` jamais lu du body (POST /clients)
- Unicité email par organisation (index composé `{ organizationId, email }` unique)
- Suppression physique uniquement (pas de soft delete ; les clients n'ont pas de champ `isActive`)
- Garde-fou avant suppression : vérification des contrats actifs (`status: 'actif'`)
- `country` par défaut `'France'` côté service ET côté Zod schema

### Tests à écrire (pour QA Agent)
- `GET /api/clients` : liste scoped à l'org, pagination, filtre search (companyName/contactName/email)
- `GET /api/clients/:id` : 200 si trouvé dans l'org, 404 si absent ou mauvais org, 404 si ObjectId invalide
- `POST /api/clients` : 201 + ignore `organizationId` du body, 409 si email dupliqué dans l'org, 400 si validation Zod échoue (phone FR invalide, postalCode != 5 chiffres, siret != 14 chiffres)
- `PATCH /api/clients/:id` : 200 + objet mis à jour, 404 si absent, 409 si email existe déjà dans l'org
- `DELETE /api/clients/:id` : 200 si supprimé, 409 si contrats actifs, 404 si absent
- Vérifier qu'un OPERATOR (sans `clients:create`) reçoit 403 sur `POST /api/clients`
- Vérifier qu'un client d'une org A n'est pas accessible depuis une requête d'un user de l'org B

---

## [2026-03-16] — Frontend Agent — Gestion des contrats (CRUD)

### Tâche
Implémenter la page de gestion complète des contrats de location (`/contracts`) côté frontend.
Stack : React 18 + TypeScript strict + Vite + Tailwind CSS + Zustand.

### Fichiers créés / modifiés

#### 1. `frontend/src/services/contracts.ts` — CRÉÉ
Service de gestion des contrats (couche API) :

**Interfaces exportées :**
- `ContractItem` : entité contrat renvoyée par l'API — gère le cas populé (`clientId` / `vehicleId` union `string | objet`)
- `CreateContractPayload` : payload de création
- `UpdateContractPayload` : `Partial<CreateContractPayload> & { status?: ContractStatus }`
- `ContractsListResponse` : réponse paginée (contracts, total, page, limit, totalPages)

**Classe `ContractsService` avec méthodes :**
- `listContracts(params?)` — GET `/contracts` avec filtres status/clientId/vehicleId/page/limit
- `getContract(id)` — GET `/contracts/:id`
- `createContract(payload)` — POST `/contracts` → 201
- `updateContract(id, payload)` — PATCH `/contracts/:id`
- `deleteContract(id)` — DELETE `/contracts/:id`

**Exports :** `const contractsService` (named) + `export default contractsService`

#### 2. `frontend/src/pages/ContractsPage.tsx` — REMPLACÉ (stub → page complète)
Page complète de gestion des contrats. Structure :

**Header** identique au pattern UsersPage (logo `<Truck>` dans `bg-primary-100 p-2 rounded-lg` + `<UserMenu />`)

**Protection d'accès :**
- `useEffect` → `navigate('/login')` si `!isAuthenticated`
- Mur "Accès refusé" si permission `CONTRACTS_READ` absente

**États locaux :**
- `contracts`, `total`, `isLoading`, `error`, `filterStatus`, `page`, `totalPages`
- `changingStatusId` (pour désactiver les boutons inline pendant le PATCH)
- `showCreateModal`, `editingContract`, `deletingContract`

**`fetchContracts`** via `useCallback` + pattern `fetchRef` pour éviter les dépendances cycliques dans `useEffect`

**Filtre statut :** select → Tous / Brouillon / Actif / Terminé / Annulé

**Tableau colonnes :** N° Contrat | Client | Véhicule | Période | Montant total | Statut | Actions
- Client : `getClientLabel()` — affiche `companyName` si objet populé, sinon `_id` brut
- Véhicule : `getVehicleLabel()` + sous-label `registrationNumber` via `getVehicleSubLabel()`
- Montant : `formatCurrency()` — Intl.NumberFormat EUR, affiche `—` si undefined
- `StatusBadge` : gris / vert / bleu / rouge selon `ContractStatus`
- Skeleton : 3 `SkeletonRow` (7 colonnes) pendant le chargement

**Changement de statut inline** (`StatusActions`) :
- `brouillon` → bouton "Activer" (vert) + "Annuler" (rouge)
- `actif` → bouton "Terminer" (bleu) + "Annuler" (rouge)
- `termine` / `annule` → aucun bouton
- Bouton désactivé (`disabled`) pendant le PATCH en cours (`changingStatusId`)
- Visible uniquement si permission `CONTRACTS_UPDATE`

**Bouton "Modifier"** : visible si `CONTRACTS_UPDATE`

**Bouton "Supprimer"** : visible si `CONTRACTS_DELETE` ET statut `brouillon` ou `annule`

**Composants internes :**
- `ContractForm` : formulaire partagé (création + édition)
  - `ContractFormData` : tous les champs en `string` pour la compatibilité avec les inputs HTML
  - Selects clients / véhicules chargés depuis `GET /clients?limit=100` et `GET /vehicles?status=disponible&limit=100`
  - Champ `contractNumber` en lecture seule (mode édition uniquement)
  - **Calcul estimé temps réel** : `dailyRate × jours` affiché dans une card bleue dès que les deux valeurs sont renseignées
- `useContractOptions(open)` : hook interne — charge clients + véhicules en parallèle via `Promise.all`
- `CreateModal` : modal création avec validation client-side
- `EditModal` : modal édition pré-remplie (résolution du `clientId`/`vehicleId` populé → string `_id`)
- `DeleteDialog` : dialog de confirmation de suppression
- `StatusActions` : boutons inline de transition de statut
- `StatusBadge` : badge coloré par `ContractStatus`
- `SkeletonRow` : skeleton 7 colonnes avec `animate-pulse`

**Helpers :**
- `formatDateFR(dateStr)` : format court `fr-FR` (ex: "1 mars 2026")
- `formatCurrency(amount)` : Intl EUR fr-FR
- `calculateDays(startDate, endDate)` : durée en jours entiers (Math.ceil)
- `getClientLabel(clientId)`, `getVehicleLabel(vehicleId)`, `getVehicleSubLabel(vehicleId)` : gestion union type string | objet populé

**`deliveryLocation`** : set à `{ type: 'Point', coordinates: [0, 0] }` par défaut en création (coordonnées optionnelles côté UX)

#### 3. `frontend/src/services/index.ts` — MODIFIÉ
Ajout des exports :
```ts
export { contractsService } from './contracts';
export type { ContractItem, CreateContractPayload, UpdateContractPayload, ContractsListResponse } from './contracts';
```

### Résultat validation TypeScript
```
npx tsc --noEmit → ✅ 0 erreur
```

### Décisions techniques
- `ContractFormData` utilise exclusivement des `string` pour tous les champs numériques (`dailyRate`, `deposit`) afin d'éviter les divergences de type avec les `<input type="number">` ; conversion en `parseFloat()` uniquement au moment de la soumission
- Le hook `useContractOptions` gère l'annulation via un flag `cancelled` pour éviter les setState sur un composant démonté
- `fetchRef` pattern utilisé (comme dans UsersPage) pour déclencher `fetchContracts` depuis un `useEffect` sans l'inclure dans ses dépendances (évite les boucles infinies avec `useCallback`)
- La résolution du `clientId`/`vehicleId` populé est centralisée dans des helpers (`getClientLabel`, `getVehicleLabel`) et dans `EditModal` (extraction du `_id` pour pré-remplir le select)
- Zéro `any` TypeScript strict — les cas union `string | objet` sont traités explicitement avec `typeof === 'object' && !== null`
- `pages/index.ts` et `App.tsx` avaient déjà `ContractsPage` intégré (par un agent précédent) — aucune modification nécessaire

### Tests à écrire (pour QA Agent)
- Non authentifié : redirection vers `/login`
- Sans permission `CONTRACTS_READ` : mur "Accès refusé" visible
- Chargement : 3 skeleton rows `animate-pulse` s'affichent
- Tableau rempli : colonnes N°/Client/Véhicule/Période/Montant/Statut/Actions correctes
- `clientId` populé (objet) → affiche `companyName` ; non populé (string) → affiche l'ID brut
- `vehicleId` populé → affiche `name` + `registrationNumber` en sous-titre
- Filtre statut : change la liste + reset la page à 1
- Changement de statut `brouillon → actif` : bouton "Activer" PATCH `/contracts/:id` + badge mis à jour
- Changement de statut `actif → annule` : bouton "Annuler" → véhicule libéré côté backend
- Boutons statut masqués pour `termine` et `annule`
- Bouton "Supprimer" visible uniquement pour `brouillon` et `annule` ; absent pour `actif` et `termine`
- Modal création : validation (client requis, véhicule requis, endDate > startDate, dailyRate > 0, adresse requise)
- Calcul estimé : s'affiche dès que `dailyRate` et les deux dates sont renseignés, se met à jour en temps réel
- `deliveryLocation` fixé à `[0, 0]` par défaut (pas de champ de coordonnées visible)
- Modal édition : `contractNumber` en lecture seule ; champs pré-remplis depuis le contrat
- Modal édition : `clientId`/`vehicleId` populés correctement résolus en `_id` dans le select
- Dialog suppression : confirmation → contrat retiré de la liste sans rechargement
- Erreur API liste : message rouge + bouton "Réessayer"
- Pagination : boutons Précédent/Suivant désactivés aux limites

---

## [2026-03-16] — Frontend Agent — ClientsPage complète (CRUD) + service clients.ts

### Tâche
Remplacer le stub `ClientsPage.tsx` par la page complète de gestion des clients.
Écrire le service `clients.ts` (conforme à l'API backend `/api/clients`).

### Fichiers créés / modifiés

#### 1. `frontend/src/services/clients.ts` — RÉÉCRIT (version complète)
Service de gestion des clients (couche API).

**Interfaces exportées :** `ClientItem`, `CreateClientPayload`, `UpdateClientPayload`, `ClientsListResponse`

**Classe `ClientsService` :** `listClients`, `getClient`, `createClient`, `updateClient`, `deleteClient`

**Exports :** `const clientsService` (named) + `export default clientsService`

#### 2. `frontend/src/pages/ClientsPage.tsx` — REMPLACÉ (stub → page complète)
Page CRUD complète : header (Truck + UserMenu), protection auth, debounce 300ms, tableau 5 colonnes, skeleton 3 lignes, modals Création/Édition/Suppression, pagination, mutations optimistes.

**Permissions :** `CLIENTS_CREATE` / `CLIENTS_UPDATE` / `CLIENTS_DELETE`

#### 3. `frontend/src/services/index.ts` — MODIFIÉ
- Ajout exports `clientsService` + types clients
- Correction : suppression de `VehicleListParams` (export fantôme → erreur TS préexistante)

### Résultat validation TypeScript
```
npx tsc --noEmit → ✅ 0 erreur
```

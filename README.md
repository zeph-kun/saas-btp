# SaaS BTP - Plateforme de Télématique et Gestion de Flotte

Plateforme SaaS de télématique dédiée aux loueurs d'engins BTP (mini-pelles, chargeuses, matériels remorquables). Solution de géolocalisation temps réel, anti-vol et gestion locative.

## 🚀 Fonctionnalités

- **Géolocalisation temps réel** des engins via GPS
- **Geofencing** : Zones de sécurité avec alertes de sortie
- **Anti-vol** : Détection de mouvements hors horaires autorisés
- **Gestion locative** : Suivi des contrats, clients, maintenance
- **Dashboard interactif** avec carte Leaflet
- **Alertes en temps réel** via WebSocket

## 🛠️ Stack Technique

### Backend
- **Node.js** + **Express** (TypeScript)
- **MongoDB** avec **Mongoose**
- **Socket.io** pour le temps réel
- **Zod** pour la validation
- Index géospatiaux **2dsphere**

### Frontend
- **React 18** (TypeScript)
- **Vite** pour le bundling
- **Tailwind CSS** pour le styling
- **Leaflet** pour la cartographie
- **Zustand** pour le state management

## 📁 Structure du Projet

```
saas-btp/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration (DB, env)
│   │   ├── controllers/    # Contrôleurs REST
│   │   ├── middleware/     # Middlewares Express
│   │   ├── models/         # Modèles Mongoose
│   │   ├── routes/         # Routes API
│   │   ├── services/       # Logique métier
│   │   ├── types/          # Types TypeScript
│   │   ├── validators/     # Schémas Zod
│   │   ├── websocket/      # Socket.io
│   │   ├── index.ts        # Point d'entrée
│   │   └── seed.ts         # Données de démo
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/     # Composants React
│   │   ├── pages/          # Pages de l'app
│   │   ├── services/       # API client, WebSocket
│   │   ├── stores/         # State Zustand
│   │   ├── types/          # Types partagés
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
└── README.md
```

## 🚀 Installation

### Prérequis

- Node.js 18+
- MongoDB 6+ (local ou Atlas)
- npm ou yarn

### 1. Cloner et installer

```bash
cd saas-btp

# Backend
cd backend
npm install
cp .env.example .env
# Éditer .env avec votre configuration MongoDB

# Frontend
cd ../frontend
npm install
```

### 2. Configurer MongoDB

Assurez-vous que MongoDB est lancé localement ou configurez l'URI dans `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/saas-btp
```

### 3. Seed des données de démonstration

```bash
cd backend
npx tsx src/seed.ts
```

### 4. Lancer l'application

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

L'application sera accessible sur http://localhost:5173

## 📊 Index Géospatiaux MongoDB (2dsphere)

### Configuration dans Mongoose

Les index `2dsphere` sont déclarés directement dans les schémas :

```typescript
// Dans Vehicle.ts
const vehicleSchema = new Schema({
  location: {
    type: geoJSONPointSchema,
    required: true,
    index: '2dsphere', // Index géospatial
  },
  // ...
});

// Index composé pour requêtes par organisation + position
vehicleSchema.index({ organizationId: 1, location: '2dsphere' });
```

### Requêtes géospatiales utilisées

1. **$near** - Trouve les véhicules proches d'un point :
```typescript
Vehicle.find({
  location: {
    $near: {
      $geometry: { type: 'Point', coordinates: [lng, lat] },
      $maxDistance: 1000, // mètres
    },
  },
});
```

2. **$geoWithin** - Véhicules dans un polygone :
```typescript
Vehicle.find({
  location: {
    $geoWithin: {
      $geometry: geofence.area, // GeoJSON Polygon
    },
  },
});
```

3. **$geoIntersects** - Détection de sortie de zone :
```typescript
Geofence.find({
  area: {
    $geoIntersects: {
      $geometry: vehicleLocation, // GeoJSON Point
    },
  },
});
```

## 🔌 API REST

### Véhicules
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/vehicles` | Liste avec pagination |
| GET | `/api/vehicles/:id` | Détail d'un véhicule |
| GET | `/api/vehicles/:id/details` | Véhicule + contrat + client |
| POST | `/api/vehicles` | Créer un véhicule |
| PUT | `/api/vehicles/:id` | Modifier |
| PATCH | `/api/vehicles/:id/location` | Mettre à jour la position |
| GET | `/api/vehicles/near?lng=&lat=&radius=` | Recherche géographique |

### Geofences
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/geofences` | Liste des zones |
| POST | `/api/geofences` | Créer une zone |
| GET | `/api/geofences/:id/vehicles` | Véhicules dans la zone |

### Alertes
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/alerts` | Alertes actives |
| PATCH | `/api/alerts/:id/acknowledge` | Acquitter |
| PATCH | `/api/alerts/:id/resolve` | Résoudre |

## 🔔 WebSocket Events

### Client → Serveur
- `join:organization` : Rejoindre une organisation
- `tracker:location` : Envoyer une position GPS

### Serveur → Client
- `vehicle:location` : Mise à jour de position
- `alert:new` : Nouvelle alerte
- `alert:updated` : Alerte modifiée
- `vehicles:positions` : Broadcast périodique

## 🏗️ Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Tracker   │ ←───────────────→  │   Backend   │
│     GPS     │                    │  (Node.js)  │
└─────────────┘                    └──────┬──────┘
                                          │
┌─────────────┐     REST API              │
│  Frontend   │ ←───────────────→  ┌──────┴──────┐
│   (React)   │                    │   MongoDB   │
│             │ ←── WebSocket ──→  │  (2dsphere) │
└─────────────┘                    └─────────────┘
```

## 📝 License

MIT

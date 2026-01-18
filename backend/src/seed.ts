import mongoose from 'mongoose';
import { Vehicle, Geofence, Client, Contract, Alert, User, RefreshToken } from './models/index.js';
import { UserRole } from './models/User.js';
import {
  VehicleType,
  VehicleStatus,
  ContractStatus,
  AlertType,
  AlertSeverity,
  AlertStatus,
} from './types/index.js';
import config, { DEMO_ORGANIZATION_ID } from './config/index.js';

/**
 * Script de seed pour créer des données de démonstration
 * Exécuter avec: npx tsx src/seed.ts
 */

const DEMO_ORG_ID = new mongoose.Types.ObjectId(DEMO_ORGANIZATION_ID);

// Données de démonstration pour les véhicules
const vehiclesData = [
  {
    registrationNumber: 'BTP-001',
    internalCode: 'MP-001',
    name: 'Mini-pelle Kubota KX61',
    type: VehicleType.MINI_PELLE,
    brand: 'Kubota',
    vehicleModel: 'KX61-3',
    year: 2022,
    serialNumber: 'KUB2022MP001',
    location: {
      type: 'Point' as const,
      coordinates: [2.3522, 48.8566] as [number, number], // Paris centre
    },
    status: VehicleStatus.EN_LOCATION,
    fuelLevel: 75,
    engineHours: 1250,
  },
  {
    registrationNumber: 'BTP-002',
    internalCode: 'CH-001',
    name: 'Chargeuse Bobcat S650',
    type: VehicleType.CHARGEUSE,
    brand: 'Bobcat',
    vehicleModel: 'S650',
    year: 2021,
    serialNumber: 'BOB2021CH001',
    location: {
      type: 'Point' as const,
      coordinates: [2.3488, 48.8534] as [number, number], // Près de Notre-Dame
    },
    status: VehicleStatus.EN_LOCATION,
    fuelLevel: 45,
    engineHours: 2100,
  },
  {
    registrationNumber: 'BTP-003',
    internalCode: 'MP-002',
    name: 'Mini-pelle CAT 301.7',
    type: VehicleType.MINI_PELLE,
    brand: 'Caterpillar',
    vehicleModel: '301.7',
    year: 2023,
    serialNumber: 'CAT2023MP002',
    location: {
      type: 'Point' as const,
      coordinates: [2.2945, 48.8584] as [number, number], // Tour Eiffel
    },
    status: VehicleStatus.DISPONIBLE,
    fuelLevel: 90,
    engineHours: 450,
  },
  {
    registrationNumber: 'BTP-004',
    internalCode: 'NA-001',
    name: 'Nacelle Haulotte HA16',
    type: VehicleType.NACELLE,
    brand: 'Haulotte',
    vehicleModel: 'HA16 RTJ Pro',
    year: 2020,
    serialNumber: 'HAU2020NA001',
    location: {
      type: 'Point' as const,
      coordinates: [2.3376, 48.8606] as [number, number], // Louvre
    },
    status: VehicleStatus.EN_MAINTENANCE,
    fuelLevel: 60,
    engineHours: 3200,
  },
  {
    registrationNumber: 'BTP-005',
    internalCode: 'GE-001',
    name: 'Groupe électrogène Atlas Copco',
    type: VehicleType.GROUPE_ELECTROGENE,
    brand: 'Atlas Copco',
    vehicleModel: 'QAS 40',
    year: 2022,
    serialNumber: 'ATL2022GE001',
    location: {
      type: 'Point' as const,
      coordinates: [2.3200, 48.8650] as [number, number], // Opéra
    },
    status: VehicleStatus.EN_LOCATION,
    fuelLevel: 80,
    engineHours: 890,
  },
];

// Données pour les geofences (zones de chantier)
const geofencesData = [
  {
    name: 'Chantier Saint-Germain',
    description: 'Zone de construction résidentielle',
    area: {
      type: 'Polygon' as const,
      coordinates: [[
        [2.3500, 48.8550],
        [2.3550, 48.8550],
        [2.3550, 48.8580],
        [2.3500, 48.8580],
        [2.3500, 48.8550],
      ]],
    },
    isActive: true,
    allowedHours: { start: '07:00', end: '19:00' },
    allowedDays: [1, 2, 3, 4, 5], // Lun-Ven
    color: '#3B82F6',
  },
  {
    name: 'Dépôt Principal',
    description: 'Zone de stockage des engins',
    area: {
      type: 'Polygon' as const,
      coordinates: [[
        [2.2900, 48.8550],
        [2.3000, 48.8550],
        [2.3000, 48.8620],
        [2.2900, 48.8620],
        [2.2900, 48.8550],
      ]],
    },
    isActive: true,
    color: '#22C55E',
  },
  {
    name: 'Chantier Opéra',
    description: 'Rénovation bâtiment historique',
    area: {
      type: 'Polygon' as const,
      coordinates: [[
        [2.3150, 48.8620],
        [2.3250, 48.8620],
        [2.3250, 48.8680],
        [2.3150, 48.8680],
        [2.3150, 48.8620],
      ]],
    },
    isActive: true,
    allowedHours: { start: '08:00', end: '18:00' },
    allowedDays: [1, 2, 3, 4, 5, 6], // Lun-Sam
    color: '#F59E0B',
  },
];

// Données pour les clients
const clientsData = [
  {
    companyName: 'Bouygues Construction',
    contactName: 'Jean Dupont',
    email: 'j.dupont@bouygues.fr',
    phone: '01 23 45 67 89',
    address: {
      street: '1 avenue Eugène Freyssinet',
      city: 'Guyancourt',
      postalCode: '78280',
      country: 'France',
    },
    siret: '57209352100012',
  },
  {
    companyName: 'Vinci Construction',
    contactName: 'Marie Martin',
    email: 'm.martin@vinci.com',
    phone: '01 98 76 54 32',
    address: {
      street: '1 cours Ferdinand de Lesseps',
      city: 'Rueil-Malmaison',
      postalCode: '92500',
      country: 'France',
    },
    siret: '55208131766522',
  },
];

async function seed() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Connecté à MongoDB');

    // Nettoyer les collections
    console.log('🧹 Nettoyage des collections...');
    await Promise.all([
      Vehicle.deleteMany({}),
      Geofence.deleteMany({}),
      Client.deleteMany({}),
      Contract.deleteMany({}),
      Alert.deleteMany({}),
    ]);

    // Créer les geofences
    console.log('🗺️ Création des geofences...');
    const geofences = await Geofence.insertMany(
      geofencesData.map((g) => ({
        ...g,
        organizationId: DEMO_ORG_ID,
        assignedVehicles: [],
      }))
    );
    console.log(`   ${geofences.length} geofences créées`);

    // Créer les véhicules
    console.log('🚜 Création des véhicules...');
    const vehicles = await Vehicle.insertMany(
      vehiclesData.map((v, i) => ({
        ...v,
        organizationId: DEMO_ORG_ID,
        lastLocationUpdate: new Date(),
        assignedGeofences: [geofences[i % geofences.length]._id],
      }))
    );
    console.log(`   ${vehicles.length} véhicules créés`);

    // Mettre à jour les geofences avec les véhicules assignés
    for (const geofence of geofences) {
      const assignedVehicles = vehicles
        .filter((v: typeof vehicles[0]) => v.assignedGeofences.some((g: mongoose.Types.ObjectId) => g.equals(geofence._id)))
        .map((v: typeof vehicles[0]) => v._id);
      await Geofence.findByIdAndUpdate(geofence._id, {
        $set: { assignedVehicles },
      });
    }

    // Créer les clients
    console.log('👥 Création des clients...');
    const clients = await Client.insertMany(
      clientsData.map((c) => ({
        ...c,
        organizationId: DEMO_ORG_ID,
      }))
    );
    console.log(`   ${clients.length} clients créés`);

    // Créer des contrats
    console.log('📝 Création des contrats...');
    const contracts = await Contract.insertMany([
      {
        contractNumber: 'CTR-2026-001',
        clientId: clients[0]._id,
        vehicleId: vehicles[0]._id,
        organizationId: DEMO_ORG_ID,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-02-28'),
        dailyRate: 150,
        deposit: 1000,
        deliveryLocation: vehicles[0].location,
        deliveryAddress: '15 rue de la Construction, 75006 Paris',
        geofenceId: geofences[0]._id,
        status: ContractStatus.ACTIF,
      },
      {
        contractNumber: 'CTR-2026-002',
        clientId: clients[1]._id,
        vehicleId: vehicles[1]._id,
        organizationId: DEMO_ORG_ID,
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-03-10'),
        dailyRate: 200,
        deposit: 1500,
        deliveryLocation: vehicles[1].location,
        deliveryAddress: '8 avenue du Chantier, 75004 Paris',
        geofenceId: geofences[0]._id,
        status: ContractStatus.ACTIF,
      },
    ]);
    console.log(`   ${contracts.length} contrats créés`);

    // Créer quelques alertes de démonstration
    console.log('🚨 Création des alertes de démonstration...');
    const alerts = await Alert.insertMany([
      {
        type: AlertType.GEOFENCE_EXIT,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
        vehicleId: vehicles[0]._id,
        geofenceId: geofences[0]._id,
        organizationId: DEMO_ORG_ID,
        message: `⚠️ ${vehicles[0].name} s'approche de la limite de zone`,
        location: vehicles[0].location,
        triggeredAt: new Date(),
      },
      {
        type: AlertType.BATTERY_LOW,
        severity: AlertSeverity.INFO,
        status: AlertStatus.ACKNOWLEDGED,
        vehicleId: vehicles[3]._id,
        organizationId: DEMO_ORG_ID,
        message: `🔋 Batterie faible sur ${vehicles[3].name}`,
        location: vehicles[3].location,
        triggeredAt: new Date(Date.now() - 3600000), // 1h avant
        acknowledgedAt: new Date(),
      },
    ]);
    console.log(`   ${alerts.length} alertes créées`);

    // Créer les utilisateurs de démonstration
    console.log('👤 Création des utilisateurs de démonstration...');
    
    // Supprimer les utilisateurs et tokens existants
    await User.deleteMany({ organizationId: DEMO_ORG_ID });
    await RefreshToken.deleteMany({});

    const users = await User.create([
      {
        email: 'admin@btploc.fr',
        password: 'Admin123!', // Sera hashé automatiquement
        firstName: 'Jean',
        lastName: 'Dupont',
        role: UserRole.ADMIN,
        organizationId: DEMO_ORG_ID,
        isActive: true,
      },
      {
        email: 'manager@btploc.fr',
        password: 'Manager123!',
        firstName: 'Marie',
        lastName: 'Martin',
        role: UserRole.MANAGER,
        organizationId: DEMO_ORG_ID,
        isActive: true,
      },
      {
        email: 'operateur@btploc.fr',
        password: 'Operateur123!',
        firstName: 'Pierre',
        lastName: 'Bernard',
        role: UserRole.OPERATOR,
        organizationId: DEMO_ORG_ID,
        isActive: true,
      },
    ]);
    console.log(`   ${users.length} utilisateurs créés`);

    console.log('\n✨ Seed terminé avec succès!');
    console.log(`\n📊 Résumé:`);
    console.log(`   - Organization ID: ${DEMO_ORG_ID}`);
    console.log(`   - ${vehicles.length} véhicules`);
    console.log(`   - ${geofences.length} geofences`);
    console.log(`   - ${clients.length} clients`);
    console.log(`   - ${contracts.length} contrats`);
    console.log(`   - ${alerts.length} alertes`);
    console.log(`   - ${users.length} utilisateurs`);
    
    console.log('\n🔑 Comptes de démonstration:');
    console.log('   Admin:     admin@btploc.fr / Admin123!');
    console.log('   Manager:   manager@btploc.fr / Manager123!');
    console.log('   Opérateur: operateur@btploc.fr / Operateur123!');

  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Déconnecté de MongoDB');
  }
}

// Exécuter le seed
seed();

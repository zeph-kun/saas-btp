import { z } from 'zod';
import { VehicleType, VehicleStatus, ContractStatus, AlertStatus } from '../types/index.js';

/**
 * Schémas de validation Zod pour les entrées API
 * Validation stricte côté serveur avec messages d'erreur en français
 */

// ============================================
// Schémas de base réutilisables
// ============================================

export const geoJSONPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // Longitude
    z.number().min(-90).max(90),   // Latitude
  ]),
});

export const geoJSONPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(
    z.array(z.tuple([z.number(), z.number()])).min(4)
  ).min(1),
});

export const mongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'ID MongoDB invalide');

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================
// Schémas Vehicle
// ============================================

export const createVehicleSchema = z.object({
  registrationNumber: z.string().min(1, 'Immatriculation requise').max(20),
  internalCode: z.string().min(1, 'Code interne requis').max(20),
  name: z.string().min(1, 'Nom requis').max(100),
  type: z.nativeEnum(VehicleType, {
    errorMap: () => ({ message: 'Type d\'engin invalide' }),
  }),
  brand: z.string().min(1, 'Marque requise').max(50),
  vehicleModel: z.string().min(1, 'Modèle requis').max(50),
  year: z.number().min(1990).max(new Date().getFullYear() + 1),
  serialNumber: z.string().min(1, 'Numéro de série requis'),
  location: geoJSONPointSchema,
  trackerId: z.string().optional(),
  fuelLevel: z.number().min(0).max(100).optional(),
  engineHours: z.number().min(0).optional(),
  odometer: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().omit({
  // Ces champs ne peuvent pas être modifiés
});

export const updateVehicleLocationSchema = z.object({
  location: geoJSONPointSchema,
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
});

export const updateVehicleStatusSchema = z.object({
  status: z.nativeEnum(VehicleStatus),
});

export const vehicleQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(VehicleStatus).optional(),
  type: z.nativeEnum(VehicleType).optional(),
  search: z.string().optional(),
});

// ============================================
// Schémas Geofence
// ============================================

export const createGeofenceSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  description: z.string().max(500).optional(),
  area: geoJSONPolygonSchema,
  isActive: z.boolean().default(true),
  allowedHours: z.object({
    start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format HH:mm requis'),
    end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format HH:mm requis'),
  }).optional(),
  allowedDays: z.array(z.number().min(0).max(6)).optional(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#3B82F6'),
  assignedVehicles: z.array(mongoIdSchema).optional(),
});

export const updateGeofenceSchema = createGeofenceSchema.partial();

// ============================================
// Schémas Contract
// ============================================

const baseContractSchema = z.object({
  clientId: mongoIdSchema,
  vehicleId: mongoIdSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  dailyRate: z.number().min(0, 'Le tarif doit être positif'),
  deposit: z.number().min(0).optional(),
  deliveryLocation: geoJSONPointSchema,
  deliveryAddress: z.string().min(1, 'Adresse de livraison requise'),
  notes: z.string().max(2000).optional(),
});

export const createContractSchema = baseContractSchema.refine(
  (data) => data.endDate > data.startDate,
  { message: 'La date de fin doit être postérieure à la date de début', path: ['endDate'] }
);

export const updateContractSchema = baseContractSchema.partial().extend({
  status: z.nativeEnum(ContractStatus).optional(),
});

// ============================================
// Schémas Alert
// ============================================

export const updateAlertStatusSchema = z.object({
  status: z.enum([AlertStatus.ACKNOWLEDGED, AlertStatus.RESOLVED]),
  resolutionNotes: z.string().max(1000).optional(),
});

export const alertQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(AlertStatus).optional(),
  vehicleId: mongoIdSchema.optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
});

// ============================================
// Schémas Client
// ============================================

export const createClientSchema = z.object({
  companyName: z.string().min(1, 'Nom de l\'entreprise requis').max(200),
  contactName: z.string().min(1, 'Nom du contact requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().regex(
    /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
    'Numéro de téléphone français invalide'
  ),
  address: z.object({
    street: z.string().min(1, 'Rue requise'),
    city: z.string().min(1, 'Ville requise'),
    postalCode: z.string().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres)'),
    country: z.string().default('France'),
  }),
  siret: z.string().regex(/^\d{14}$/, 'SIRET invalide (14 chiffres)').optional(),
});

export const updateClientSchema = createClientSchema.partial();

// ============================================
// Schémas pour les requêtes géospatiales
// ============================================

export const nearQuerySchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  radiusMeters: z.coerce.number().min(1).max(100000).default(1000),
});

export const withinPolygonQuerySchema = z.object({
  polygon: geoJSONPolygonSchema,
});

// ============================================
// Types inférés des schémas
// ============================================

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type UpdateVehicleLocationInput = z.infer<typeof updateVehicleLocationSchema>;
export type VehicleQueryInput = z.infer<typeof vehicleQuerySchema>;

export type CreateGeofenceInput = z.infer<typeof createGeofenceSchema>;
export type UpdateGeofenceInput = z.infer<typeof updateGeofenceSchema>;

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export type NearQueryInput = z.infer<typeof nearQuerySchema>;

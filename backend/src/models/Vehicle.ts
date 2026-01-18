import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  VehicleType,
  VehicleStatus,
  GeoJSONPoint,
} from '../types/index.js';

/**
 * Interface pour le document Mongoose Vehicle
 */
export interface IVehicleDocument extends Document {
  _id: Types.ObjectId;
  registrationNumber: string;
  internalCode: string;
  name: string;
  type: VehicleType;
  brand: string;
  vehicleModel: string;
  year: number;
  serialNumber: string;
  location: GeoJSONPoint;
  lastLocationUpdate: Date;
  trackerId?: string;
  status: VehicleStatus;
  fuelLevel?: number;
  engineHours?: number;
  odometer?: number;
  organizationId: Types.ObjectId;
  assignedGeofences: Types.ObjectId[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface pour les méthodes statiques du modèle
 */
export interface IVehicleModel extends Model<IVehicleDocument> {
  findNearLocation(
    longitude: number,
    latitude: number,
    maxDistanceMeters: number
  ): Promise<IVehicleDocument[]>;
  
  findWithinPolygon(
    coordinates: number[][][]
  ): Promise<IVehicleDocument[]>;
}

/**
 * Schéma GeoJSON Point pour la localisation
 */
const geoJSONPointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function (coords: number[]) {
          if (coords.length !== 2) return false;
          const [lng, lat] = coords;
          return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
        },
        message: 'Coordonnées invalides. Format: [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

/**
 * Schéma Mongoose pour les véhicules/engins BTP
 */
const vehicleSchema = new Schema<IVehicleDocument>(
  {
    registrationNumber: {
      type: String,
      required: [true, 'Le numéro d\'immatriculation est requis'],
      trim: true,
      uppercase: true,
    },
    internalCode: {
      type: String,
      required: [true, 'Le code interne est requis'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
      maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
    },
    type: {
      type: String,
      enum: Object.values(VehicleType),
      required: [true, 'Le type d\'engin est requis'],
    },
    brand: {
      type: String,
      required: [true, 'La marque est requise'],
      trim: true,
    },
    vehicleModel: {
      type: String,
      required: [true, 'Le modèle est requis'],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'L\'année est requise'],
      min: [1990, 'Année minimum: 1990'],
      max: [new Date().getFullYear() + 1, 'Année invalide'],
    },
    serialNumber: {
      type: String,
      required: [true, 'Le numéro de série est requis'],
      unique: true,
      trim: true,
    },
    location: {
      type: geoJSONPointSchema,
      required: true,
      index: '2dsphere',
    },
    lastLocationUpdate: {
      type: Date,
      default: Date.now,
    },
    trackerId: {
      type: String,
      trim: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: Object.values(VehicleStatus),
      default: VehicleStatus.DISPONIBLE,
      index: true,
    },
    fuelLevel: {
      type: Number,
      min: 0,
      max: 100,
    },
    engineHours: {
      type: Number,
      min: 0,
      default: 0,
    },
    odometer: {
      type: Number,
      min: 0,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    assignedGeofences: [{
      type: Schema.Types.ObjectId,
      ref: 'Geofence',
    }],
    notes: {
      type: String,
      maxlength: [1000, 'Les notes ne peuvent pas dépasser 1000 caractères'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        ret.model = ret.vehicleModel;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index composites
vehicleSchema.index({ organizationId: 1, status: 1 });
vehicleSchema.index({ organizationId: 1, type: 1 });
vehicleSchema.index({ organizationId: 1, location: '2dsphere' });

// Méthodes statiques
vehicleSchema.statics.findNearLocation = function (
  longitude: number,
  latitude: number,
  maxDistanceMeters: number
): Promise<IVehicleDocument[]> {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistanceMeters,
      },
    },
  }).exec();
};

vehicleSchema.statics.findWithinPolygon = function (
  coordinates: number[][][]
): Promise<IVehicleDocument[]> {
  return this.find({
    location: {
      $geoWithin: {
        $geometry: {
          type: 'Polygon',
          coordinates: coordinates,
        },
      },
    },
  }).exec();
};

// Middleware pre-save
vehicleSchema.pre('save', function (next) {
  if (this.isModified('location')) {
    this.lastLocationUpdate = new Date();
  }
  next();
});

export const Vehicle = mongoose.model<IVehicleDocument, IVehicleModel>(
  'Vehicle',
  vehicleSchema
);

export default Vehicle;

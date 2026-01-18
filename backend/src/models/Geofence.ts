import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { GeoJSONPolygon } from '../types/index.js';

/**
 * Interface pour le document Mongoose Geofence
 */
export interface IGeofenceDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  area: GeoJSONPolygon;
  isActive: boolean;
  allowedHours?: {
    start: string;
    end: string;
  };
  allowedDays?: number[];
  organizationId: Types.ObjectId;
  assignedVehicles: Types.ObjectId[];
  color: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Méthodes d'instance
  containsPoint(longitude: number, latitude: number): Promise<boolean>;
  isWithinAllowedHours(): boolean;
  isAllowedDay(): boolean;
}

/**
 * Interface pour les méthodes statiques du modèle
 */
export interface IGeofenceModel extends Model<IGeofenceDocument> {
  findContainingPoint(
    longitude: number,
    latitude: number,
    organizationId?: string
  ): Promise<IGeofenceDocument[]>;
  
  findIntersectingArea(
    polygon: GeoJSONPolygon
  ): Promise<IGeofenceDocument[]>;
}

/**
 * Schéma GeoJSON Polygon pour les zones de geofencing
 */
const geoJSONPolygonSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Polygon'],
      required: true,
      default: 'Polygon',
    },
    coordinates: {
      type: [[[Number]]],
      required: true,
      validate: {
        validator: function (coords: number[][][]) {
          if (!coords || coords.length === 0) return false;
          
          for (const ring of coords) {
            if (ring.length < 4) return false;
            
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
              return false;
            }
            
            for (const point of ring) {
              if (point.length !== 2) return false;
              const [lng, lat] = point;
              if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
                return false;
              }
            }
          }
          return true;
        },
        message: 'Polygone GeoJSON invalide.',
      },
    },
  },
  { _id: false }
);

/**
 * Schéma des horaires autorisés
 */
const allowedHoursSchema = new Schema(
  {
    start: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format horaire invalide (HH:mm)'],
    },
    end: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format horaire invalide (HH:mm)'],
    },
  },
  { _id: false }
);

/**
 * Schéma Mongoose pour les Geofences
 */
const geofenceSchema = new Schema<IGeofenceDocument>(
  {
    name: {
      type: String,
      required: [true, 'Le nom de la zone est requis'],
      trim: true,
      maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'La description ne peut pas dépasser 500 caractères'],
    },
    area: {
      type: geoJSONPolygonSchema,
      required: [true, 'La zone géographique est requise'],
      index: '2dsphere',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    allowedHours: {
      type: allowedHoursSchema,
      required: false,
    },
    allowedDays: {
      type: [Number],
      validate: {
        validator: function (days: number[]) {
          return days.every((d) => d >= 0 && d <= 6);
        },
        message: 'Les jours doivent être entre 0 (Dimanche) et 6 (Samedi)',
      },
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    assignedVehicles: [{
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
    }],
    color: {
      type: String,
      default: '#3B82F6',
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Couleur hexadécimale invalide'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index composites
geofenceSchema.index({ organizationId: 1, isActive: 1 });
geofenceSchema.index({ organizationId: 1, area: '2dsphere' });

// Méthodes statiques
geofenceSchema.statics.findContainingPoint = function (
  longitude: number,
  latitude: number,
  organizationId?: string
): Promise<IGeofenceDocument[]> {
  const query: Record<string, unknown> = {
    isActive: true,
    area: {
      $geoIntersects: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
      },
    },
  };

  if (organizationId) {
    query.organizationId = new mongoose.Types.ObjectId(organizationId);
  }

  return this.find(query).exec();
};

geofenceSchema.statics.findIntersectingArea = function (
  polygon: GeoJSONPolygon
): Promise<IGeofenceDocument[]> {
  return this.find({
    isActive: true,
    area: {
      $geoIntersects: {
        $geometry: polygon,
      },
    },
  }).exec();
};

// Méthodes d'instance
geofenceSchema.methods.containsPoint = async function (
  longitude: number,
  latitude: number
): Promise<boolean> {
  const GeofenceModel = this.constructor as IGeofenceModel;
  const results = await GeofenceModel.findContainingPoint(longitude, latitude);
  return results.some((g) => g._id.equals(this._id));
};

geofenceSchema.methods.isWithinAllowedHours = function (): boolean {
  const doc = this as IGeofenceDocument;
  if (!doc.allowedHours) return true;

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  return currentTime >= doc.allowedHours.start && currentTime <= doc.allowedHours.end;
};

geofenceSchema.methods.isAllowedDay = function (): boolean {
  const doc = this as IGeofenceDocument;
  if (!doc.allowedDays || doc.allowedDays.length === 0) return true;
  
  const today = new Date().getDay();
  return doc.allowedDays.includes(today);
};

export const Geofence = mongoose.model<IGeofenceDocument, IGeofenceModel>(
  'Geofence',
  geofenceSchema
);

export default Geofence;

import mongoose, { Schema, Document, Types } from 'mongoose';
import { AlertType, AlertSeverity, AlertStatus, GeoJSONPoint } from '../types/index.js';

/**
 * Interface pour le document Mongoose Alert
 */
export interface IAlertDocument extends Document {
  _id: Types.ObjectId;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  vehicleId: Types.ObjectId;
  geofenceId?: Types.ObjectId;
  organizationId: Types.ObjectId;
  message: string;
  location: GeoJSONPoint;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: Types.ObjectId;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Méthodes d'instance
  acknowledge(userId: string): Promise<IAlertDocument>;
  resolve(userId: string, notes?: string): Promise<IAlertDocument>;
}

/**
 * Schéma GeoJSON Point pour la position de l'alerte
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
    },
  },
  { _id: false }
);

/**
 * Schéma Mongoose pour les alertes de sécurité
 */
const alertSchema = new Schema<IAlertDocument>(
  {
    type: {
      type: String,
      enum: Object.values(AlertType),
      required: [true, 'Le type d\'alerte est requis'],
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(AlertSeverity),
      required: [true, 'La sévérité est requise'],
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(AlertStatus),
      default: AlertStatus.ACTIVE,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Le véhicule est requis'],
      index: true,
    },
    geofenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Geofence',
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: [true, 'Le message est requis'],
      maxlength: [500, 'Le message ne peut pas dépasser 500 caractères'],
    },
    location: {
      type: geoJSONPointSchema,
      required: [true, 'La position est requise'],
      index: '2dsphere',
    },
    triggeredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolutionNotes: {
      type: String,
      maxlength: [1000, 'Les notes de résolution ne peuvent pas dépasser 1000 caractères'],
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
alertSchema.index({ organizationId: 1, status: 1, triggeredAt: -1 });
alertSchema.index({ vehicleId: 1, triggeredAt: -1 });
alertSchema.index({ organizationId: 1, type: 1, severity: 1 });
alertSchema.index({ organizationId: 1, location: '2dsphere' });

// Méthodes statiques
alertSchema.statics.findActiveByOrganization = function (
  organizationId: string
): Promise<IAlertDocument[]> {
  return this.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    status: AlertStatus.ACTIVE,
  })
    .sort({ triggeredAt: -1 })
    .populate('vehicleId', 'name registrationNumber type')
    .exec();
};

alertSchema.statics.countBySeverity = async function (
  organizationId: string
): Promise<Record<AlertSeverity, number>> {
  const result = await this.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        status: AlertStatus.ACTIVE,
      },
    },
    {
      $group: {
        _id: '$severity',
        count: { $sum: 1 },
      },
    },
  ]);

  const counts: Record<AlertSeverity, number> = {
    [AlertSeverity.INFO]: 0,
    [AlertSeverity.WARNING]: 0,
    [AlertSeverity.CRITICAL]: 0,
  };

  for (const item of result) {
    counts[item._id as AlertSeverity] = item.count;
  }

  return counts;
};

// Méthodes d'instance
alertSchema.methods.acknowledge = function (userId: string): Promise<IAlertDocument> {
  const doc = this as IAlertDocument;
  doc.status = AlertStatus.ACKNOWLEDGED;
  doc.acknowledgedAt = new Date();
  doc.acknowledgedBy = new mongoose.Types.ObjectId(userId);
  return doc.save();
};

alertSchema.methods.resolve = function (
  userId: string,
  notes?: string
): Promise<IAlertDocument> {
  const doc = this as IAlertDocument;
  doc.status = AlertStatus.RESOLVED;
  doc.resolvedAt = new Date();
  doc.resolvedBy = new mongoose.Types.ObjectId(userId);
  if (notes) {
    doc.resolutionNotes = notes;
  }
  return doc.save();
};

// Virtuals
alertSchema.virtual('durationMinutes').get(function (this: IAlertDocument) {
  const endTime = this.resolvedAt || new Date();
  return Math.floor((endTime.getTime() - this.triggeredAt.getTime()) / (1000 * 60));
});

export const Alert = mongoose.model<IAlertDocument>('Alert', alertSchema);

export default Alert;

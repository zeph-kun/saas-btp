import mongoose, { Schema, Document, Types } from 'mongoose';
import { ContractStatus, GeoJSONPoint } from '../types/index.js';

/**
 * Interface pour le document Mongoose Contract
 */
export interface IContractDocument extends Document {
  _id: Types.ObjectId;
  contractNumber: string;
  clientId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  organizationId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  dailyRate: number;
  deposit?: number;
  totalAmount?: number;
  deliveryLocation: GeoJSONPoint;
  deliveryAddress: string;
  geofenceId?: Types.ObjectId;
  status: ContractStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schéma GeoJSON Point pour le lieu de livraison
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
 * Schéma Mongoose pour les contrats de location
 */
const contractSchema = new Schema<IContractDocument>(
  {
    contractNumber: {
      type: String,
      required: [true, 'Le numéro de contrat est requis'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Le client est requis'],
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Le véhicule est requis'],
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'La date de début est requise'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'La date de fin est requise'],
      validate: {
        validator: function (this: IContractDocument, endDate: Date) {
          return endDate > this.startDate;
        },
        message: 'La date de fin doit être postérieure à la date de début',
      },
    },
    dailyRate: {
      type: Number,
      required: [true, 'Le tarif journalier est requis'],
      min: [0, 'Le tarif ne peut pas être négatif'],
    },
    deposit: {
      type: Number,
      min: [0, 'La caution ne peut pas être négative'],
      default: 0,
    },
    totalAmount: {
      type: Number,
      min: [0, 'Le montant total ne peut pas être négatif'],
    },
    deliveryLocation: {
      type: geoJSONPointSchema,
      required: [true, 'Le lieu de livraison est requis'],
      index: '2dsphere',
    },
    deliveryAddress: {
      type: String,
      required: [true, 'L\'adresse de livraison est requise'],
      trim: true,
    },
    geofenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Geofence',
    },
    status: {
      type: String,
      enum: Object.values(ContractStatus),
      default: ContractStatus.BROUILLON,
      index: true,
    },
    notes: {
      type: String,
      maxlength: [2000, 'Les notes ne peuvent pas dépasser 2000 caractères'],
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
contractSchema.index({ organizationId: 1, status: 1 });
contractSchema.index({ vehicleId: 1, status: 1 });
contractSchema.index({ startDate: 1, endDate: 1, status: 1 });
contractSchema.index({ organizationId: 1, deliveryLocation: '2dsphere' });

// Virtuals
contractSchema.virtual('durationDays').get(function (this: IContractDocument) {
  const diff = this.endDate.getTime() - this.startDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

contractSchema.virtual('isCurrentlyActive').get(function (this: IContractDocument) {
  if (this.status !== ContractStatus.ACTIF) return false;
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
});

// Middleware pre-save
contractSchema.pre('save', function (next) {
  const doc = this as IContractDocument;
  
  // Calcul du montant total
  if (this.isModified('dailyRate') || this.isModified('startDate') || this.isModified('endDate')) {
    const durationDays = Math.ceil(
      (doc.endDate.getTime() - doc.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    doc.totalAmount = doc.dailyRate * durationDays;
  }
  next();
});

contractSchema.pre('save', async function (next) {
  const doc = this as IContractDocument;
  
  // Génération du numéro de contrat
  if (this.isNew && !doc.contractNumber) {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    doc.contractNumber = `CTR-${year}${month}-${random}`;
  }
  next();
});

export const Contract = mongoose.model<IContractDocument>(
  'Contract',
  contractSchema
);

export default Contract;

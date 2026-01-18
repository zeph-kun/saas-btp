import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Interface pour le document Mongoose Client
 */
export interface IClientDocument extends Document {
  _id: Types.ObjectId;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  siret?: string;
  organizationId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schéma pour l'adresse
 */
const addressSchema = new Schema(
  {
    street: {
      type: String,
      required: [true, 'La rue est requise'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'La ville est requise'],
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, 'Le code postal est requis'],
      trim: true,
      match: [/^\d{5}$/, 'Code postal invalide (5 chiffres)'],
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: 'France',
    },
  },
  { _id: false }
);

/**
 * Schéma Mongoose pour les clients
 */
const clientSchema = new Schema<IClientDocument>(
  {
    companyName: {
      type: String,
      required: [true, 'Le nom de l\'entreprise est requis'],
      trim: true,
      maxlength: [200, 'Le nom ne peut pas dépasser 200 caractères'],
    },
    contactName: {
      type: String,
      required: [true, 'Le nom du contact est requis'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'L\'email est requis'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
    },
    phone: {
      type: String,
      required: [true, 'Le téléphone est requis'],
      trim: true,
      match: [/^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/, 'Numéro de téléphone invalide'],
    },
    address: {
      type: addressSchema,
      required: [true, 'L\'adresse est requise'],
    },
    siret: {
      type: String,
      trim: true,
      match: [/^\d{14}$/, 'SIRET invalide (14 chiffres)'],
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
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
clientSchema.index({ organizationId: 1, companyName: 'text' });
clientSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export const Client = mongoose.model<IClientDocument>('Client', clientSchema);

export default Client;

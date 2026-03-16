import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Interface pour le document Mongoose Organization
 */
export interface IOrganizationDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Génère un slug à partir d'un nom
 * Ex: "Dupont Jean - Organisation" → "dupont-jean-organisation"
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents
    .replace(/[^a-z0-9\s-]/g, '')    // garde lettres, chiffres, espaces, tirets
    .trim()
    .replace(/\s+/g, '-')            // espaces → tirets
    .replace(/-+/g, '-');            // tirets multiples → un seul
}

/**
 * Schéma Mongoose pour les organisations
 */
const organizationSchema = new Schema<IOrganizationDocument>(
  {
    name: {
      type: String,
      required: [true, 'Le nom de l\'organisation est requis'],
      trim: true,
      maxlength: [200, 'Le nom ne peut pas dépasser 200 caractères'],
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [220, 'Le slug ne peut pas dépasser 220 caractères'],
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Index sur isActive pour les requêtes de filtrage
organizationSchema.index({ isActive: 1 });

/**
 * Middleware pre-validate : auto-génère le slug depuis le name
 * En cas de collision, on suffixe avec un fragment d'ObjectId
 */
organizationSchema.pre('validate', async function (next) {
  if (this.isModified('name') || this.isNew) {
    const baseSlug = generateSlug(this.name);
    let slug = baseSlug;

    // Vérifier l'unicité et suffixer si nécessaire
    const exists = await (this.constructor as mongoose.Model<IOrganizationDocument>).findOne({
      slug,
      _id: { $ne: this._id },
    });

    if (exists) {
      // Suffixe court basé sur l'_id pour garantir l'unicité
      slug = `${baseSlug}-${this._id.toString().slice(-6)}`;
    }

    this.slug = slug;
  }
  next();
});

export const Organization = mongoose.model<IOrganizationDocument>('Organization', organizationSchema);

export default Organization;

import mongoose from 'mongoose';

/**
 * Constantes globales de l'application
 */

// ObjectId fixe pour la démonstration (24 caractères hexadécimaux)
// Utilisé quand aucune organisation n'est spécifiée
export const DEMO_ORGANIZATION_ID = '000000000000000000000001';

/**
 * Vérifie si une chaîne est un ObjectId MongoDB valide
 */
export function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id;
}

/**
 * Convertit un ID d'organisation en ObjectId, avec fallback sur l'ID de démo
 */
export function getOrganizationObjectId(organizationId: string): mongoose.Types.ObjectId {
  if (isValidObjectId(organizationId)) {
    return new mongoose.Types.ObjectId(organizationId);
  }
  return new mongoose.Types.ObjectId(DEMO_ORGANIZATION_ID);
}

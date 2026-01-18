import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/index.js';

/**
 * Middleware de gestion globale des erreurs
 * Capture toutes les erreurs non gérées et retourne une réponse standardisée
 */
export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('❌ Erreur:', error);

  // Erreurs Mongoose de validation
  if (error.name === 'ValidationError') {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Erreur de validation des données',
        details: extractMongooseErrors(error),
      },
    };
    res.status(400).json(response);
    return;
  }

  // Erreur de cast MongoDB (ID invalide)
  if (error.name === 'CastError') {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INVALID_ID',
        message: 'ID de ressource invalide',
      },
    };
    res.status(400).json(response);
    return;
  }

  // Erreur de duplication (clé unique)
  if ((error as Error & { code?: number }).code === 11000) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'DUPLICATE_KEY',
        message: 'Une ressource avec cette valeur existe déjà',
      },
    };
    res.status(409).json(response);
    return;
  }

  // Erreur générique
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Une erreur interne est survenue'
        : error.message,
    },
  };
  res.status(500).json(response);
}

/**
 * Middleware 404 pour les routes non trouvées
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route non trouvée: ${req.method} ${req.path}`,
    },
  };
  res.status(404).json(response);
}

/**
 * Extrait les erreurs de validation Mongoose
 */
function extractMongooseErrors(error: Error): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const mongooseError = error as Error & { errors?: Record<string, { message: string }> };
  
  if (mongooseError.errors) {
    for (const [field, err] of Object.entries(mongooseError.errors)) {
      errors[field] = [err.message];
    }
  }
  
  return errors;
}

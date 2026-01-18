import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodObject, ZodRawShape } from 'zod';
import { ApiResponse } from '../types/index.js';

/**
 * Middleware factory pour la validation des requêtes avec Zod
 * Supporte les schémas avec body, query, params ou un schéma simple
 */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Détecter si le schéma attend body/query/params ou des données directes
      const schemaShape = (schema as ZodObject<ZodRawShape>).shape;
      
      if (schemaShape && ('body' in schemaShape || 'query' in schemaShape || 'params' in schemaShape)) {
        // Schéma avec structure body/query/params
        const dataToValidate: Record<string, unknown> = {};
        if ('body' in schemaShape) dataToValidate.body = req.body;
        if ('query' in schemaShape) dataToValidate.query = req.query;
        if ('params' in schemaShape) dataToValidate.params = req.params;
        
        const validated = schema.parse(dataToValidate) as {
          body?: unknown;
          query?: unknown;
          params?: unknown;
        };
        
        // Remplacer par les données validées
        if (validated.body) req.body = validated.body;
        if (validated.query) (req as Request & { validatedQuery: unknown }).validatedQuery = validated.query;
        if (validated.params) (req as Request & { validatedParams: unknown }).validatedParams = validated.params;
      } else {
        // Schéma simple pour body uniquement (rétrocompatibilité)
        const validated = schema.parse(req.body);
        req.body = validated;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données de requête invalides',
            details: formatZodErrors(error),
          },
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
}

/**
 * Formate les erreurs Zod en un objet lisible
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }
  
  return errors;
}

/**
 * Middleware pour valider un ID MongoDB dans les params
 */
export function validateMongoId(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];
    const mongoIdRegex = /^[a-f\d]{24}$/i;
    
    if (!id || !mongoIdRegex.test(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'INVALID_ID',
          message: `ID invalide pour le paramètre: ${paramName}`,
        },
      };
      res.status(400).json(response);
      return;
    }
    
    next();
  };
}

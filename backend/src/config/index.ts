import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Schéma de validation de la configuration avec Zod
 * Garantit que toutes les variables d'environnement requises sont présentes et valides
 */
const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().min(1).max(65535).default(3001),
  
  mongodb: z.object({
    uri: z.string().url().or(z.string().startsWith('mongodb')),
  }),
  
  jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string().default('7d'),
  }),
  
  cors: z.object({
    origin: z.string().url().or(z.string().startsWith('http://localhost')),
  }),
  
  geofencing: z.object({
    defaultRadiusMeters: z.coerce.number().min(10).max(10000).default(500),
    alertCheckIntervalMs: z.coerce.number().min(5000).max(300000).default(30000),
  }),
});

type Config = z.infer<typeof configSchema>;

/**
 * Charge et valide la configuration depuis les variables d'environnement
 */
function loadConfig(): Config {
  const rawConfig = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/saas-btp',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'default-dev-secret-change-in-production-min-32-chars',
      expiresIn: process.env.JWT_EXPIRES_IN,
    },
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    },
    geofencing: {
      defaultRadiusMeters: process.env.DEFAULT_GEOFENCE_RADIUS_METERS,
      alertCheckIntervalMs: process.env.ALERT_CHECK_INTERVAL_MS,
    },
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    console.error('[Config] Configuration invalide:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

export default config;

// Re-export constants
export * from './constants.js';

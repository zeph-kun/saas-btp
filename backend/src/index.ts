import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';

import config from './config/index.js';
import database from './config/database.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/index.js';
import { initWebSocket } from './websocket/index.js';

/**
 * Point d'entrée principal du serveur backend
 * Configure Express, MongoDB et Socket.io
 */
async function bootstrap(): Promise<void> {
  // Création de l'application Express
  const app = express();

  // ============================================
  // Middlewares de sécurité et parsing
  // ============================================
  
  // Sécurité HTTP headers
  app.use(helmet());
  
  // CORS
  app.use(cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id', 'X-User-Id'],
  }));
  
  // Parsing JSON
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Logging des requêtes (sauf en test)
  if (config.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  // ============================================
  // Connexion à MongoDB
  // ============================================
  
  await database.connect();

  // ============================================
  // Routes API
  // ============================================
  
  app.use('/api', routes);

  // Route racine
  app.get('/', (_req, res) => {
    res.json({
      name: 'SaaS BTP Telematics API',
      version: '1.0.0',
      status: 'running',
      docs: '/api/health',
    });
  });

  // ============================================
  // Gestion des erreurs
  // ============================================
  
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ============================================
  // Création du serveur HTTP et WebSocket
  // ============================================
  
  const httpServer = createServer(app);
  
  // Initialiser Socket.io
  const wsServer = initWebSocket(httpServer);
  console.log('🔌 WebSocket server initialisé');

  // ============================================
  // Démarrage du serveur
  // ============================================
  
  httpServer.listen(config.port, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚜 SaaS BTP Telematics Server                            ║
║                                                            ║
║   📍 HTTP:      http://localhost:${config.port}                   ║
║   🔌 WebSocket: ws://localhost:${config.port}                     ║
║   🌍 Env:       ${config.nodeEnv.padEnd(15)}                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
  });

  // ============================================
  // Gestion de l'arrêt propre
  // ============================================
  
  const gracefulShutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} reçu. Arrêt gracieux...`);
    
    // Fermer les connexions WebSocket
    wsServer.getIO().close();
    
    // Fermer la connexion MongoDB
    await database.disconnect();
    
    // Fermer le serveur HTTP
    httpServer.close(() => {
      console.log('👋 Serveur arrêté proprement');
      process.exit(0);
    });

    // Force exit après 10s si l'arrêt ne se fait pas
    setTimeout(() => {
      console.error('Arrêt forcé après timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Lancement
bootstrap().catch((error) => {
  console.error('❌ Erreur fatale au démarrage:', error);
  process.exit(1);
});

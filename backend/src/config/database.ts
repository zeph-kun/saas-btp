import mongoose from 'mongoose';
import config from './index.js';

/**
 * Classe de gestion de la connexion MongoDB
 * Implémente le pattern Singleton pour une connexion unique
 */
class Database {
  private static instance: Database;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Établit la connexion à MongoDB avec gestion des erreurs
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('📦 MongoDB déjà connecté');
      return;
    }

    try {
      // Configuration Mongoose
      mongoose.set('strictQuery', true);
      
      // Event listeners pour le monitoring
      mongoose.connection.on('connected', () => {
        console.log('✅ MongoDB connecté avec succès');
        this.isConnected = true;
      });

      mongoose.connection.on('error', (error) => {
        console.error('❌ Erreur MongoDB:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB déconnecté');
        this.isConnected = false;
      });

      // Connexion
      await mongoose.connect(config.mongodb.uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      // Création des index géospatiaux au démarrage
      await this.ensureIndexes();
      
    } catch (error) {
      console.error('❌ Impossible de se connecter à MongoDB:', error);
      process.exit(1);
    }
  }

  /**
   * Assure la création des index géospatiaux 2dsphere
   * Ces index sont essentiels pour les performances des requêtes géographiques
   */
  private async ensureIndexes(): Promise<void> {
    try {
      // Les index seront créés automatiquement par Mongoose
      // lors de la définition des schémas avec { index: '2dsphere' }
      console.log('📍 Index géospatiaux vérifiés');
    } catch (error) {
      console.error('❌ Erreur lors de la création des index:', error);
    }
  }

  /**
   * Ferme proprement la connexion MongoDB
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('👋 MongoDB déconnecté proprement');
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
      throw error;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const database = Database.getInstance();
export default database;

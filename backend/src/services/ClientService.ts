import mongoose from 'mongoose';
import { Client, IClientDocument } from '../models/Client.js';
import { Contract } from '../models/index.js';

// ============================================
// Interfaces
// ============================================

export interface ClientFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateClientData {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country?: string;
  };
  siret?: string;
}

export type UpdateClientData = Partial<CreateClientData>;

// ============================================
// Erreurs métier
// ============================================

export class ClientNotFoundError extends Error {
  readonly code = 'CLIENT_NOT_FOUND';
  constructor(clientId: string) {
    super(`Client non trouvé : ${clientId}`);
    this.name = 'ClientNotFoundError';
  }
}

export class ClientConflictError extends Error {
  readonly code = 'CONFLICT';
  constructor(message: string) {
    super(message);
    this.name = 'ClientConflictError';
  }
}

// ============================================
// Service
// ============================================

/**
 * Service de gestion des clients
 * Couche métier entre les contrôleurs et le modèle Client
 */
export class ClientService {
  /**
   * Liste les clients d'une organisation avec pagination et recherche
   */
  async listClients(
    organizationId: string,
    filters: ClientFilters
  ): Promise<{ clients: IClientDocument[]; total: number }> {
    const { search, page = 1, limit = 20 } = filters;

    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const query: Record<string, unknown> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };

    if (search && search.trim().length > 0) {
      const regex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { companyName: regex },
        { contactName: regex },
        { email: regex },
      ];
    }

    const [clients, total] = await Promise.all([
      Client.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      Client.countDocuments(query),
    ]);

    return { clients, total };
  }

  /**
   * Récupère un client par son ID, scoped à l'organisation
   */
  async getClientById(
    organizationId: string,
    clientId: string
  ): Promise<IClientDocument> {
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      throw new ClientNotFoundError(clientId);
    }

    const client = await Client.findOne({
      _id: new mongoose.Types.ObjectId(clientId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
    }).exec();

    if (!client) {
      throw new ClientNotFoundError(clientId);
    }

    return client;
  }

  /**
   * Crée un client dans l'organisation
   * Vérifie l'unicité de l'email au sein de l'organisation
   */
  async createClient(
    organizationId: string,
    data: CreateClientData
  ): Promise<IClientDocument> {
    // Vérifier si l'email est déjà utilisé dans cette organisation
    const existing = await Client.findOne({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      email: data.email.toLowerCase(),
    }).exec();

    if (existing) {
      throw new ClientConflictError(
        `Un client avec l'email "${data.email}" existe déjà dans cette organisation`
      );
    }

    const client = await Client.create({
      companyName: data.companyName,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      address: {
        street: data.address.street,
        city: data.address.city,
        postalCode: data.address.postalCode,
        country: data.address.country ?? 'France',
      },
      siret: data.siret,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });

    return client;
  }

  /**
   * Met à jour un client (scoped à l'organisation)
   */
  async updateClient(
    organizationId: string,
    clientId: string,
    data: UpdateClientData
  ): Promise<IClientDocument> {
    const client = await this.getClientById(organizationId, clientId);

    // Vérifier unicité de l'email si modifié
    if (data.email !== undefined) {
      const normalizedEmail = data.email.toLowerCase();
      if (normalizedEmail !== client.email) {
        const conflict = await Client.findOne({
          organizationId: new mongoose.Types.ObjectId(organizationId),
          email: normalizedEmail,
          _id: { $ne: client._id },
        }).exec();

        if (conflict) {
          throw new ClientConflictError(
            `Un client avec l'email "${data.email}" existe déjà dans cette organisation`
          );
        }
      }
      client.email = data.email;
    }

    if (data.companyName !== undefined) client.companyName = data.companyName;
    if (data.contactName !== undefined) client.contactName = data.contactName;
    if (data.phone !== undefined) client.phone = data.phone;
    if (data.siret !== undefined) client.siret = data.siret;

    if (data.address !== undefined) {
      if (data.address.street !== undefined) {
        client.address.street = data.address.street;
      }
      if (data.address.city !== undefined) {
        client.address.city = data.address.city;
      }
      if (data.address.postalCode !== undefined) {
        client.address.postalCode = data.address.postalCode;
      }
      if (data.address.country !== undefined) {
        client.address.country = data.address.country;
      }
    }

    await client.save();

    return client;
  }

  /**
   * Supprime physiquement un client
   * Vérifie qu'aucun contrat actif n'est lié au client avant suppression
   */
  async deleteClient(
    organizationId: string,
    clientId: string
  ): Promise<void> {
    const client = await this.getClientById(organizationId, clientId);

    // Vérifier l'absence de contrats actifs
    const activeContract = await Contract.findOne({
      clientId: client._id,
      status: 'actif',
    }).exec();

    if (activeContract) {
      throw new ClientConflictError(
        'Ce client possède des contrats actifs'
      );
    }

    await Client.deleteOne({ _id: client._id }).exec();
  }
}

export const clientService = new ClientService();

export default clientService;

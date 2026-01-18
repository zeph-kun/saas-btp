import { useEffect, useState } from 'react';
import { api } from '@/services';
import { Vehicle, Alert, Contract, Client, VehicleStatus, VehicleType, AlertSeverity } from '@/types';
import {
  X,
  Truck,
  MapPin,
  Calendar,
  Fuel,
  Clock,
  AlertTriangle,
  Building,
  Phone,
  Mail,
  FileText,
} from 'lucide-react';
import clsx from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================
// Icônes par type de véhicule
// ============================================

const vehicleTypeLabels: Record<VehicleType, string> = {
  [VehicleType.MINI_PELLE]: '🚜 Mini-pelle',
  [VehicleType.CHARGEUSE]: '🚛 Chargeuse',
  [VehicleType.TRACTOPELLE]: '🚧 Tractopelle',
  [VehicleType.NACELLE]: '🏗️ Nacelle',
  [VehicleType.COMPACTEUR]: '🔄 Compacteur',
  [VehicleType.GROUPE_ELECTROGENE]: '⚡ Groupe électrogène',
  [VehicleType.REMORQUE]: '🚚 Remorque',
  [VehicleType.AUTRE]: '📦 Autre',
};

const statusColors: Record<VehicleStatus, { bg: string; text: string }> = {
  [VehicleStatus.DISPONIBLE]: { bg: 'bg-green-100', text: 'text-green-800' },
  [VehicleStatus.EN_LOCATION]: { bg: 'bg-blue-100', text: 'text-blue-800' },
  [VehicleStatus.EN_MAINTENANCE]: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  [VehicleStatus.HORS_SERVICE]: { bg: 'bg-gray-100', text: 'text-gray-800' },
  [VehicleStatus.VOLE]: { bg: 'bg-red-100', text: 'text-red-800' },
};

// ============================================
// Composant VehicleDetail
// ============================================

interface VehicleDetailProps {
  vehicleId: string;
  onClose: () => void;
}

interface VehicleDetails {
  vehicle: Vehicle;
  contract: Contract | null;
  client: Client | null;
  recentAlerts: Alert[];
}

export function VehicleDetail({ vehicleId, onClose }: VehicleDetailProps) {
  const [details, setDetails] = useState<VehicleDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'contract' | 'alerts'>('info');

  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const response = await api.getVehicleDetails(vehicleId);
        if (response.success && response.data) {
          setDetails(response.data as VehicleDetails);
        }
      } catch (error) {
        console.error('Erreur chargement détails:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [vehicleId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-8">
        <p className="text-gray-500 text-center">Véhicule non trouvé</p>
      </div>
    );
  }

  const { vehicle, contract, client, recentAlerts } = details;
  const hasActiveAlert = recentAlerts.some((a) => a.status === 'active');

  return (
    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div
        className={clsx('px-6 py-4 border-b', {
          'bg-red-50 border-red-200': hasActiveAlert,
          'bg-gray-50': !hasActiveAlert,
        })}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{vehicle.name}</h2>
              {hasActiveAlert && (
                <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  Alerte
                </span>
              )}
            </div>
            <p className="text-gray-600">{vehicle.registrationNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Statut et type */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-lg">{vehicleTypeLabels[vehicle.type]}</span>
          <span
            className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium',
              statusColors[vehicle.status].bg,
              statusColors[vehicle.status].text
            )}
          >
            {vehicle.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(['info', 'contract', 'alerts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'border-b-2 border-primary-600 text-primary-600 bg-primary-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            {tab === 'info' && 'Informations'}
            {tab === 'contract' && 'Contrat'}
            {tab === 'alerts' && `Alertes (${recentAlerts.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Tab: Informations */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            {/* Infos techniques */}
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Informations techniques
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem icon={<Truck />} label="Marque" value={vehicle.brand} />
                <InfoItem icon={<Truck />} label="Modèle" value={vehicle.model} />
                <InfoItem icon={<Calendar />} label="Année" value={vehicle.year.toString()} />
                <InfoItem icon={<FileText />} label="N° série" value={vehicle.serialNumber} />
              </div>
            </section>

            {/* Position */}
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Position actuelle
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-5 h-5 text-primary-600" />
                  <span>
                    {vehicle.location.coordinates[1].toFixed(6)},{' '}
                    {vehicle.location.coordinates[0].toFixed(6)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Dernière mise à jour:{' '}
                  {formatDistanceToNow(new Date(vehicle.lastLocationUpdate), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </p>
              </div>
            </section>

            {/* Métriques */}
            {(vehicle.fuelLevel !== undefined ||
              vehicle.engineHours !== undefined ||
              vehicle.odometer !== undefined) && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Métriques
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {vehicle.fuelLevel !== undefined && (
                    <MetricCard
                      icon={<Fuel className="w-5 h-5" />}
                      label="Carburant"
                      value={`${vehicle.fuelLevel}%`}
                      color={vehicle.fuelLevel < 20 ? 'red' : vehicle.fuelLevel < 50 ? 'yellow' : 'green'}
                    />
                  )}
                  {vehicle.engineHours !== undefined && (
                    <MetricCard
                      icon={<Clock className="w-5 h-5" />}
                      label="Heures moteur"
                      value={`${vehicle.engineHours}h`}
                    />
                  )}
                  {vehicle.odometer !== undefined && (
                    <MetricCard
                      icon={<MapPin className="w-5 h-5" />}
                      label="Compteur"
                      value={`${vehicle.odometer} km`}
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Tab: Contrat */}
        {activeTab === 'contract' && (
          <div>
            {contract && client ? (
              <div className="space-y-6">
                {/* Info contrat */}
                <section className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-blue-900">Contrat actif</h3>
                    <span className="px-2 py-1 bg-blue-200 text-blue-800 text-xs font-medium rounded">
                      {contract.contractNumber}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span>
                        Du {format(new Date(contract.startDate), 'dd/MM/yyyy')} au{' '}
                        {format(new Date(contract.endDate), 'dd/MM/yyyy')}
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span>{contract.deliveryAddress}</span>
                    </p>
                    <p className="text-blue-800 font-medium mt-2">
                      {contract.dailyRate}€/jour • Total: {contract.totalAmount}€
                    </p>
                  </div>
                </section>

                {/* Info client */}
                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Client
                  </h3>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <Building className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{client.companyName}</p>
                        <p className="text-sm text-gray-500">{client.contactName}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <a href={`mailto:${client.email}`} className="text-primary-600 hover:underline">
                          {client.email}
                        </a>
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a href={`tel:${client.phone}`} className="text-primary-600 hover:underline">
                          {client.phone}
                        </a>
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Aucun contrat actif pour ce véhicule</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Alertes */}
        {activeTab === 'alerts' && (
          <div>
            {recentAlerts.length > 0 ? (
              <div className="space-y-3">
                {recentAlerts.map((alert) => (
                  <AlertItem key={alert._id} alert={alert} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Aucune alerte récente</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Composants utilitaires
// ============================================

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="text-gray-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: 'green' | 'yellow' | 'red';
}

function MetricCard({ icon, label, value, color }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className={clsx('p-3 rounded-lg', color ? colorClasses[color] : 'bg-gray-50')}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

interface AlertItemProps {
  alert: Alert;
}

function AlertItem({ alert }: AlertItemProps) {
  const severityStyles: Record<AlertSeverity, { bg: string; border: string; icon: string }> = {
    [AlertSeverity.INFO]: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500' },
    [AlertSeverity.WARNING]: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-500' },
    [AlertSeverity.CRITICAL]: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500' },
  };

  const styles = severityStyles[alert.severity];

  return (
    <div className={clsx('p-4 rounded-lg border', styles.bg, styles.border)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={clsx('w-5 h-5 mt-0.5', styles.icon)} />
        <div className="flex-1">
          <p className="font-medium">{alert.message}</p>
          <p className="text-sm text-gray-500 mt-1">
            {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true, locale: fr })}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={clsx('px-2 py-0.5 rounded text-xs font-medium', {
                'bg-red-100 text-red-700': alert.status === 'active',
                'bg-yellow-100 text-yellow-700': alert.status === 'acknowledged',
                'bg-green-100 text-green-700': alert.status === 'resolved',
              })}
            >
              {alert.status}
            </span>
            <span className="text-xs text-gray-500">{alert.type.replace('_', ' ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VehicleDetail;

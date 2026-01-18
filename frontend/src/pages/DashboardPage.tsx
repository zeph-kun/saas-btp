import { useState, useEffect } from 'react';
import { DashboardMap, VehicleDetail, AlertListPanel, CriticalAlertBanner, UserMenu } from '@/components';
import { useVehicleStore, useAlertStore } from '@/stores';
import { Vehicle, VehicleStatus, VehicleType, AlertSeverity } from '@/types';
import {
  Truck,
  AlertTriangle,
  CheckCircle,
  Wrench,
  Package,
  TrendingUp,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';

// ============================================
// Composants de statistiques
// ============================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  trend?: number;
}

function StatCard({ icon, label, value, color, trend }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  };

  return (
    <div className={clsx('rounded-xl border p-4', colorClasses[color])}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/60">{icon}</div>
          <div>
            <p className="text-sm opacity-80">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
        {trend !== undefined && (
          <div
            className={clsx('flex items-center gap-1 text-xs font-medium', {
              'text-green-600': trend > 0,
              'text-red-600': trend < 0,
              'text-gray-500': trend === 0,
            })}
          >
            <TrendingUp className={clsx('w-3 h-3', { 'rotate-180': trend < 0 })} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Page Dashboard
// ============================================

export function DashboardPage() {
  const { vehicles, stats, fetchVehicles, fetchStats, selectedVehicle, setSelectedVehicle } = useVehicleStore();
  const { alerts, fetchAlerts, stats: alertStats, fetchStats: fetchAlertStats } = useAlertStore();
  const [isVehicleDetailOpen, setIsVehicleDetailOpen] = useState(false);

  // Charger les données au montage
  useEffect(() => {
    fetchVehicles();
    fetchStats();
    fetchAlerts();
    fetchAlertStats();
  }, [fetchVehicles, fetchStats, fetchAlerts, fetchAlertStats]);

  // Ouvrir le détail quand un véhicule est sélectionné
  useEffect(() => {
    if (selectedVehicle) {
      setIsVehicleDetailOpen(true);
    }
  }, [selectedVehicle]);

  const handleVehicleSelect = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
  };

  const handleCloseDetail = () => {
    setIsVehicleDetailOpen(false);
    setSelectedVehicle(null);
  };

  // Alertes critiques pour le bandeau
  const criticalAlerts = alerts
    .filter((a) => a.severity === AlertSeverity.CRITICAL && a.status === 'active')
    .map((alert) => {
      const vehicle = vehicles.find((v) => v._id === (typeof alert.vehicleId === 'string' ? alert.vehicleId : alert.vehicleId._id));
      return {
        alert,
        vehicle: vehicle || {
          _id: typeof alert.vehicleId === 'string' ? alert.vehicleId : alert.vehicleId._id,
          name: 'Véhicule inconnu',
          registrationNumber: '',
          type: VehicleType.AUTRE,
        },
      };
    });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Bandeau d'alerte critique */}
      {criticalAlerts.length > 0 && (
        <CriticalAlertBanner 
          alerts={criticalAlerts} 
          onAcknowledge={(id) => useAlertStore.getState().acknowledgeAlert(id)} 
        />
      )}

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Truck className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">SaaS BTP</h1>
                <p className="text-sm text-gray-500">Gestion de flotte & télématique</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>Mise à jour en temps réel</span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </div>
              <div className="h-8 w-px bg-gray-200"></div>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            icon={<Truck className="w-5 h-5" />}
            label="Total véhicules"
            value={stats?.total || 0}
            color="blue"
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Disponibles"
            value={stats?.byStatus[VehicleStatus.DISPONIBLE] || 0}
            color="green"
          />
          <StatCard
            icon={<Package className="w-5 h-5" />}
            label="En location"
            value={stats?.byStatus[VehicleStatus.EN_LOCATION] || 0}
            color="blue"
          />
          <StatCard
            icon={<Wrench className="w-5 h-5" />}
            label="En maintenance"
            value={stats?.byStatus[VehicleStatus.EN_MAINTENANCE] || 0}
            color="yellow"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Alertes actives"
            value={alertStats?.active || 0}
            color={alertStats?.active && alertStats.active > 0 ? 'red' : 'gray'}
          />
        </div>

        {/* Map and alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Carte */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Carte des engins</h2>
              <p className="text-sm text-gray-500">
                {vehicles.length} véhicule{vehicles.length > 1 ? 's' : ''} sur la carte
              </p>
            </div>
            <div className="h-[600px]">
              <DashboardMap onVehicleSelect={handleVehicleSelect} />
            </div>
          </div>

          {/* Panneau des alertes */}
          <div className="lg:col-span-1">
            <AlertListPanel className="sticky top-6" />
          </div>
        </div>

        {/* Liste des véhicules */}
        <div className="mt-6 bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Liste des engins</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engin
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mise à jour
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vehicles.map((vehicle) => {
                  const hasAlert = alerts.some(
                    (a) =>
                      (typeof a.vehicleId === 'string' ? a.vehicleId : a.vehicleId._id) === vehicle._id &&
                      a.status === 'active'
                  );

                  return (
                    <tr
                      key={vehicle._id}
                      onClick={() => handleVehicleSelect(vehicle)}
                      className={clsx(
                        'hover:bg-gray-50 cursor-pointer transition-colors',
                        hasAlert && 'bg-red-50'
                      )}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {hasAlert && (
                            <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{vehicle.name}</p>
                            <p className="text-sm text-gray-500">{vehicle.registrationNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {vehicle.type.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={clsx('px-2 py-1 rounded-full text-xs font-medium', {
                            'bg-green-100 text-green-700': vehicle.status === VehicleStatus.DISPONIBLE,
                            'bg-blue-100 text-blue-700': vehicle.status === VehicleStatus.EN_LOCATION,
                            'bg-yellow-100 text-yellow-700': vehicle.status === VehicleStatus.EN_MAINTENANCE,
                            'bg-gray-100 text-gray-700': vehicle.status === VehicleStatus.HORS_SERVICE,
                            'bg-red-100 text-red-700': vehicle.status === VehicleStatus.VOLE,
                          })}
                        >
                          {vehicle.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {vehicle.location.coordinates[1].toFixed(4)},{' '}
                        {vehicle.location.coordinates[0].toFixed(4)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {new Date(vehicle.lastLocationUpdate).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal détail véhicule */}
      {isVehicleDetailOpen && selectedVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <VehicleDetail vehicleId={selectedVehicle._id} onClose={handleCloseDetail} />
        </div>
      )}
    </div>
  );
}

export default DashboardPage;

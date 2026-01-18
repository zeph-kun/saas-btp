import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useVehicleStore, useGeofenceStore, useAlertStore } from '@/stores';
import { Vehicle, Geofence, VehicleStatus, AlertSeverity } from '@/types';
import { Truck, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

// Fix pour les icônes Leaflet avec Vite - utiliser les URLs CDN
const markerIcon2x = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const markerIcon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const markerShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// ============================================
// Icônes personnalisées pour les véhicules
// ============================================

const createVehicleIcon = (status: VehicleStatus, hasAlert: boolean) => {
  const colors: Record<VehicleStatus, string> = {
    [VehicleStatus.DISPONIBLE]: '#22c55e',
    [VehicleStatus.EN_LOCATION]: '#3b82f6',
    [VehicleStatus.EN_MAINTENANCE]: '#f59e0b',
    [VehicleStatus.HORS_SERVICE]: '#6b7280',
    [VehicleStatus.VOLE]: '#ef4444',
  };

  const color = hasAlert ? '#ef4444' : colors[status];
  const pulseClass = hasAlert ? 'animate-pulse' : '';

  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div class="relative ${pulseClass}">
        <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg" 
             style="background-color: ${color}">
          <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        </div>
        ${hasAlert ? `
          <span class="absolute -top-1 -right-1 flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        ` : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// ============================================
// Composant pour centrer la carte
// ============================================

interface MapCenterProps {
  center: [number, number] | null;
  zoom?: number;
}

function MapCenter({ center, zoom = 13 }: MapCenterProps) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  return null;
}

// ============================================
// Composant VehicleMarker
// ============================================

interface VehicleMarkerProps {
  vehicle: Vehicle;
  hasAlert: boolean;
  onClick: (vehicle: Vehicle) => void;
}

function VehicleMarker({ vehicle, hasAlert, onClick }: VehicleMarkerProps) {
  const position: [number, number] = [
    vehicle.location.coordinates[1], // latitude
    vehicle.location.coordinates[0], // longitude
  ];

  const icon = createVehicleIcon(vehicle.status, hasAlert);

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{
        click: () => onClick(vehicle),
      }}
    >
      <Popup>
        <div className="min-w-[200px]">
          <h3 className="font-bold text-lg">{vehicle.name}</h3>
          <p className="text-gray-600 text-sm">{vehicle.registrationNumber}</p>
          <div className="mt-2 space-y-1">
            <p className="text-sm">
              <span className="font-medium">Type:</span> {vehicle.type.replace('_', ' ')}
            </p>
            <p className="text-sm">
              <span className="font-medium">Statut:</span>{' '}
              <span
                className={clsx('px-2 py-0.5 rounded text-xs', {
                  'bg-green-100 text-green-800': vehicle.status === VehicleStatus.DISPONIBLE,
                  'bg-blue-100 text-blue-800': vehicle.status === VehicleStatus.EN_LOCATION,
                  'bg-yellow-100 text-yellow-800': vehicle.status === VehicleStatus.EN_MAINTENANCE,
                  'bg-gray-100 text-gray-800': vehicle.status === VehicleStatus.HORS_SERVICE,
                  'bg-red-100 text-red-800': vehicle.status === VehicleStatus.VOLE,
                })}
              >
                {vehicle.status.replace('_', ' ')}
              </span>
            </p>
            {vehicle.fuelLevel !== undefined && (
              <p className="text-sm">
                <span className="font-medium">Carburant:</span> {vehicle.fuelLevel}%
              </p>
            )}
          </div>
          {hasAlert && (
            <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
              <p className="text-red-700 text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Alerte active
              </p>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

// ============================================
// Composant GeofencePolygon
// ============================================

interface GeofencePolygonProps {
  geofence: Geofence;
}

function GeofencePolygon({ geofence }: GeofencePolygonProps) {
  // Convertir les coordonnées GeoJSON [lng, lat] en Leaflet [lat, lng]
  const positions = geofence.area.coordinates[0].map(
    (coord) => [coord[1], coord[0]] as [number, number]
  );

  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: geofence.color,
        fillColor: geofence.color,
        fillOpacity: 0.2,
        weight: 2,
      }}
    >
      <Popup>
        <div className="min-w-[150px]">
          <h3 className="font-bold">{geofence.name}</h3>
          {geofence.description && (
            <p className="text-gray-600 text-sm mt-1">{geofence.description}</p>
          )}
          {geofence.allowedHours && (
            <p className="text-sm mt-2">
              <span className="font-medium">Horaires:</span>{' '}
              {geofence.allowedHours.start} - {geofence.allowedHours.end}
            </p>
          )}
        </div>
      </Popup>
    </Polygon>
  );
}

// ============================================
// Composant DashboardMap Principal
// ============================================

interface DashboardMapProps {
  onVehicleSelect?: (vehicle: Vehicle) => void;
  className?: string;
}

export function DashboardMap({ onVehicleSelect, className }: DashboardMapProps) {
  const { vehicles, fetchVehicles, setSelectedVehicle } = useVehicleStore();
  const { geofences, fetchGeofences } = useGeofenceStore();
  const { alerts } = useAlertStore();
  const mapRef = useRef<L.Map | null>(null);

  // Charger les données au montage
  useEffect(() => {
    fetchVehicles();
    fetchGeofences();
  }, [fetchVehicles, fetchGeofences]);

  // IDs des véhicules avec alertes actives
  const vehiclesWithAlerts = new Set(
    alerts
      .filter((a) => a.severity === AlertSeverity.CRITICAL || a.severity === AlertSeverity.WARNING)
      .map((a) => (typeof a.vehicleId === 'string' ? a.vehicleId : a.vehicleId._id))
  );

  // Calculer le centre de la carte basé sur les véhicules
  const mapCenter: [number, number] = vehicles.length > 0
    ? [
        vehicles.reduce((sum, v) => sum + v.location.coordinates[1], 0) / vehicles.length,
        vehicles.reduce((sum, v) => sum + v.location.coordinates[0], 0) / vehicles.length,
      ]
    : [48.8566, 2.3522]; // Paris par défaut

  const handleVehicleClick = useCallback(
    (vehicle: Vehicle) => {
      setSelectedVehicle(vehicle);
      onVehicleSelect?.(vehicle);
    },
    [setSelectedVehicle, onVehicleSelect]
  );

  return (
    <div className={clsx('relative w-full h-full min-h-[400px]', className)}>
      <MapContainer
        center={mapCenter}
        zoom={12}
        className="w-full h-full rounded-lg"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Geofences */}
        {geofences.map((geofence) => (
          <GeofencePolygon key={geofence._id} geofence={geofence} />
        ))}

        {/* Véhicules */}
        {vehicles.map((vehicle) => (
          <VehicleMarker
            key={vehicle._id}
            vehicle={vehicle}
            hasAlert={vehiclesWithAlerts.has(vehicle._id)}
            onClick={handleVehicleClick}
          />
        ))}

        <MapCenter center={mapCenter} />
      </MapContainer>

      {/* Légende */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <h4 className="font-semibold text-sm mb-2">Légende</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span>En location</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span>En maintenance</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
            <span>Alerte active</span>
          </div>
        </div>
      </div>

      {/* Compteur de véhicules */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-gray-600" />
          <span className="font-semibold">{vehicles.length} véhicules</span>
        </div>
      </div>
    </div>
  );
}

export default DashboardMap;

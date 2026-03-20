import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Polyline,
  Popup,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useGeofenceStore } from '@/stores';
import { Geofence, GeoJSONPolygon } from '@/types';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Clock,
  Calendar,
  Shield,
  ShieldOff,
  X,
  Check,
  MousePointer,
  Undo2,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ============================================
// Constantes
// ============================================

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_NAMES_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DEFAULT_CENTER: [number, number] = [48.8566, 2.3522]; // Paris
const PRESET_COLORS = [
  '#3B82F6', '#EF4444', '#22C55E', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

const vertexIcon = L.divIcon({
  className: 'geofence-vertex',
  html: '<div class="w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// ============================================
// Composant de dessin de polygone sur la carte
// ============================================

interface DrawingLayerProps {
  isDrawing: boolean;
  points: [number, number][];
  onAddPoint: (latlng: [number, number]) => void;
  color: string;
}

function DrawingLayer({ isDrawing, points, onAddPoint, color }: DrawingLayerProps) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  if (points.length === 0) return null;

  return (
    <>
      {/* Vertices */}
      {points.map((point, i) => (
        <Marker key={i} position={point} icon={vertexIcon} />
      ))}
      {/* Lignes entre les points */}
      {points.length >= 2 && (
        <Polyline
          positions={points}
          pathOptions={{ color, weight: 2, dashArray: '6' }}
        />
      )}
      {/* Apercu du polygone fermé */}
      {points.length >= 3 && (
        <Polygon
          positions={points}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 2, dashArray: '6' }}
        />
      )}
    </>
  );
}

// ============================================
// Modal de formulaire Geofence
// ============================================

interface GeofenceFormData {
  name: string;
  description: string;
  color: string;
  isActive: boolean;
  allowedHoursEnabled: boolean;
  allowedHoursStart: string;
  allowedHoursEnd: string;
  allowedDays: number[];
}

interface GeofenceFormModalProps {
  isOpen: boolean;
  editingGeofence: Geofence | null;
  drawnPoints: [number, number][];
  onSubmit: (data: GeofenceFormData) => void;
  onClose: () => void;
  isLoading: boolean;
}

function GeofenceFormModal({
  isOpen,
  editingGeofence,
  drawnPoints,
  onSubmit,
  onClose,
  isLoading,
}: GeofenceFormModalProps) {
  const [form, setForm] = useState<GeofenceFormData>({
    name: '',
    description: '',
    color: PRESET_COLORS[0],
    isActive: true,
    allowedHoursEnabled: false,
    allowedHoursStart: '07:00',
    allowedHoursEnd: '19:00',
    allowedDays: [],
  });

  useEffect(() => {
    if (editingGeofence) {
      setForm({
        name: editingGeofence.name,
        description: editingGeofence.description || '',
        color: editingGeofence.color,
        isActive: editingGeofence.isActive,
        allowedHoursEnabled: !!editingGeofence.allowedHours,
        allowedHoursStart: editingGeofence.allowedHours?.start || '07:00',
        allowedHoursEnd: editingGeofence.allowedHours?.end || '19:00',
        allowedDays: editingGeofence.allowedDays || [],
      });
    } else {
      setForm({
        name: '',
        description: '',
        color: PRESET_COLORS[0],
        isActive: true,
        allowedHoursEnabled: false,
        allowedHoursStart: '07:00',
        allowedHoursEnd: '19:00',
        allowedDays: [],
      });
    }
  }, [editingGeofence, isOpen]);

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      allowedDays: prev.allowedDays.includes(day)
        ? prev.allowedDays.filter((d) => d !== day)
        : [...prev.allowedDays, day],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!editingGeofence && drawnPoints.length < 3) return;
    onSubmit(form);
  };

  if (!isOpen) return null;

  const isNew = !editingGeofence;
  const hasValidPolygon = editingGeofence || drawnPoints.length >= 3;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {isNew ? 'Nouvelle zone de geofencing' : `Modifier "${editingGeofence?.name}"`}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de la zone *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Chantier Défense, Dépôt Rungis..."
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Description optionnelle..."
            />
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className={clsx(
                    'w-8 h-8 rounded-full border-2 transition-transform',
                    form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Statut actif */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm text-gray-700">Zone active</span>
          </div>

          {/* Restrictions horaires */}
          <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowedHoursEnabled}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, allowedHoursEnabled: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Restrictions horaires</span>
              </div>
            </div>

            {form.allowedHoursEnabled && (
              <>
                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Début</label>
                    <input
                      type="time"
                      value={form.allowedHoursStart}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, allowedHoursStart: e.target.value }))
                      }
                      className="px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <span className="text-gray-400 mt-5">-</span>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fin</label>
                    <input
                      type="time"
                      value={form.allowedHoursEnd}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, allowedHoursEnd: e.target.value }))
                      }
                      className="px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>

                {/* Jours autorisés */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500">
                      Jours autorisés (vide = tous les jours)
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {DAY_NAMES.map((name, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={clsx(
                          'px-2 py-1 rounded text-xs font-medium transition-colors',
                          form.allowedDays.includes(i)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Info polygone */}
          {isNew && (
            <div
              className={clsx(
                'flex items-center gap-2 text-sm p-2 rounded',
                hasValidPolygon ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
              )}
            >
              <MapPin className="w-4 h-4 flex-shrink-0" />
              {hasValidPolygon
                ? `Polygone: ${drawnPoints.length} points`
                : `Dessinez au moins 3 points sur la carte`}
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || !form.name.trim() || !hasValidPolygon}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isNew ? 'Créer' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Modal de confirmation de suppression
// ============================================

interface DeleteConfirmModalProps {
  geofence: Geofence | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function DeleteConfirmModal({ geofence, onConfirm, onCancel, isLoading }: DeleteConfirmModalProps) {
  if (!geofence) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Supprimer la zone</h3>
        <p className="text-gray-600 mb-4">
          Supprimer <span className="font-medium">"{geofence.name}"</span> ?
          Les alertes associées ne seront plus déclenchées.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Carte de geofence dans la liste
// ============================================

interface GeofenceCardProps {
  geofence: Geofence;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

function GeofenceCard({
  geofence,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onToggleActive,
}: GeofenceCardProps) {
  return (
    <div
      onClick={onSelect}
      className={clsx(
        'border rounded-lg p-3 cursor-pointer transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: geofence.color }}
          />
          <h4 className="font-medium text-gray-900 truncate">{geofence.name}</h4>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive();
            }}
            className="p-1 hover:bg-gray-200 rounded"
            title={geofence.isActive ? 'Désactiver' : 'Activer'}
          >
            {geofence.isActive ? (
              <Shield className="w-4 h-4 text-green-600" />
            ) : (
              <ShieldOff className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 hover:bg-gray-200 rounded"
            title="Modifier"
          >
            <Pencil className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-red-100 rounded"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {geofence.description && (
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{geofence.description}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span
          className={clsx(
            'px-2 py-0.5 rounded-full',
            geofence.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          )}
        >
          {geofence.isActive ? 'Active' : 'Inactive'}
        </span>

        {geofence.allowedHours && (
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {geofence.allowedHours.start}-{geofence.allowedHours.end}
          </span>
        )}

        {geofence.allowedDays && geofence.allowedDays.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            {geofence.allowedDays.map((d) => DAY_NAMES[d]).join(', ')}
          </span>
        )}

        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {geofence.area.coordinates[0].length - 1} sommets
        </span>
      </div>
    </div>
  );
}

// ============================================
// Page principale GeofencesPage
// ============================================

export function GeofencesPage() {
  const {
    geofences,
    isLoading,
    fetchGeofences,
    createGeofence,
    updateGeofence,
    deleteGeofence,
    selectedGeofence,
    setSelectedGeofence,
  } = useGeofenceStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [deletingGeofence, setDeletingGeofence] = useState<Geofence | null>(null);
  const [drawColor] = useState(PRESET_COLORS[0]);

  useEffect(() => {
    fetchGeofences();
  }, [fetchGeofences]);

  // Calculer le centre de la carte basé sur les geofences existantes
  const mapCenter: [number, number] = (() => {
    if (geofences.length === 0) return DEFAULT_CENTER;
    const allCoords = geofences.flatMap((g) => g.area.coordinates[0]);
    const avgLat = allCoords.reduce((sum, c) => sum + c[1], 0) / allCoords.length;
    const avgLng = allCoords.reduce((sum, c) => sum + c[0], 0) / allCoords.length;
    return [avgLat, avgLng];
  })();

  // --- Handlers dessin ---

  const startDrawing = () => {
    setIsDrawing(true);
    setDrawnPoints([]);
    setEditingGeofence(null);
    setSelectedGeofence(null);
  };

  const addPoint = useCallback(
    (latlng: [number, number]) => {
      if (isDrawing) {
        setDrawnPoints((prev) => [...prev, latlng]);
      }
    },
    [isDrawing]
  );

  const undoLastPoint = () => {
    setDrawnPoints((prev) => prev.slice(0, -1));
  };

  const finishDrawing = () => {
    if (drawnPoints.length < 3) {
      toast.error('Il faut au moins 3 points pour former une zone');
      return;
    }
    setIsDrawing(false);
    setIsFormOpen(true);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setDrawnPoints([]);
  };

  // --- Handlers CRUD ---

  const handleCreate = async (formData: GeofenceFormData) => {
    // Convertir points Leaflet [lat, lng] en GeoJSON [lng, lat] et fermer le polygone
    const geoCoords = drawnPoints.map((p) => [p[1], p[0]] as [number, number]);
    geoCoords.push(geoCoords[0]); // Fermer le polygone

    const area: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [geoCoords],
    };

    const data: Partial<Geofence> = {
      name: formData.name,
      description: formData.description || undefined,
      color: formData.color,
      isActive: formData.isActive,
      area,
      allowedHours: formData.allowedHoursEnabled
        ? { start: formData.allowedHoursStart, end: formData.allowedHoursEnd }
        : undefined,
      allowedDays:
        formData.allowedHoursEnabled && formData.allowedDays.length > 0
          ? formData.allowedDays
          : undefined,
    };

    const result = await createGeofence(data);
    if (result) {
      toast.success(`Zone "${result.name}" créée`);
      setIsFormOpen(false);
      setDrawnPoints([]);
    }
  };

  const handleEdit = (geofence: Geofence) => {
    setEditingGeofence(geofence);
    setIsFormOpen(true);
    setIsDrawing(false);
    setDrawnPoints([]);
  };

  const handleUpdate = async (formData: GeofenceFormData) => {
    if (!editingGeofence) return;

    const data: Partial<Geofence> = {
      name: formData.name,
      description: formData.description || undefined,
      color: formData.color,
      isActive: formData.isActive,
      allowedHours: formData.allowedHoursEnabled
        ? { start: formData.allowedHoursStart, end: formData.allowedHoursEnd }
        : undefined,
      allowedDays:
        formData.allowedHoursEnabled && formData.allowedDays.length > 0
          ? formData.allowedDays
          : undefined,
    };

    // Si un nouveau polygone a été dessiné, l'utiliser
    if (drawnPoints.length >= 3) {
      const geoCoords = drawnPoints.map((p) => [p[1], p[0]] as [number, number]);
      geoCoords.push(geoCoords[0]);
      data.area = { type: 'Polygon', coordinates: [geoCoords] };
    }

    const result = await updateGeofence(editingGeofence._id, data);
    if (result) {
      toast.success(`Zone "${result.name}" mise à jour`);
      setIsFormOpen(false);
      setEditingGeofence(null);
      setDrawnPoints([]);
    }
  };

  const handleToggleActive = async (geofence: Geofence) => {
    const result = await updateGeofence(geofence._id, { isActive: !geofence.isActive });
    if (result) {
      toast.success(`Zone "${result.name}" ${result.isActive ? 'activée' : 'désactivée'}`);
    }
  };

  const handleDelete = async () => {
    if (!deletingGeofence) return;
    const success = await deleteGeofence(deletingGeofence._id);
    if (success) {
      toast.success(`Zone "${deletingGeofence.name}" supprimée`);
      setDeletingGeofence(null);
      if (selectedGeofence?._id === deletingGeofence._id) {
        setSelectedGeofence(null);
      }
    }
  };

  // --- Centrer la carte sur une geofence ---

  const handleSelectGeofence = (geofence: Geofence) => {
    setSelectedGeofence(selectedGeofence?._id === geofence._id ? null : geofence);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Zones de Geofencing</h1>
                <p className="text-sm text-gray-500">
                  {geofences.length} zone{geofences.length > 1 ? 's' : ''} configurée
                  {geofences.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {!isDrawing ? (
              <button
                onClick={startDrawing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nouvelle zone
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <MousePointer className="w-4 h-4" />
                  Cliquez sur la carte pour placer les points ({drawnPoints.length} point
                  {drawnPoints.length > 1 ? 's' : ''})
                </span>
                {drawnPoints.length > 0 && (
                  <button
                    onClick={undoLastPoint}
                    className="flex items-center gap-1 px-3 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    <Undo2 className="w-4 h-4" />
                    Annuler
                  </button>
                )}
                {drawnPoints.length >= 3 && (
                  <button
                    onClick={finishDrawing}
                    className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Check className="w-4 h-4" />
                    Terminer
                  </button>
                )}
                <button
                  onClick={cancelDrawing}
                  className="flex items-center gap-1 px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Carte */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg overflow-hidden">
            <div
              className={clsx(
                'h-[600px]',
                isDrawing && 'ring-2 ring-blue-500 ring-inset rounded-xl'
              )}
            >
              <MapContainer center={mapCenter} zoom={12} className="w-full h-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Geofences existantes */}
                {geofences.map((geofence) => {
                  const positions = geofence.area.coordinates[0].map(
                    (coord) => [coord[1], coord[0]] as [number, number]
                  );
                  const isSelected = selectedGeofence?._id === geofence._id;

                  return (
                    <Polygon
                      key={geofence._id}
                      positions={positions}
                      pathOptions={{
                        color: geofence.color,
                        fillColor: geofence.color,
                        fillOpacity: isSelected ? 0.35 : geofence.isActive ? 0.2 : 0.05,
                        weight: isSelected ? 3 : 2,
                        dashArray: geofence.isActive ? undefined : '8',
                      }}
                      eventHandlers={{
                        click: () => handleSelectGeofence(geofence),
                      }}
                    >
                      <Popup>
                        <div className="min-w-[180px]">
                          <h3 className="font-bold">{geofence.name}</h3>
                          {geofence.description && (
                            <p className="text-gray-600 text-sm mt-1">{geofence.description}</p>
                          )}
                          <div className="mt-2 space-y-1 text-sm">
                            <p>
                              Statut:{' '}
                              <span
                                className={
                                  geofence.isActive ? 'text-green-600' : 'text-gray-500'
                                }
                              >
                                {geofence.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </p>
                            {geofence.allowedHours && (
                              <p>
                                Horaires: {geofence.allowedHours.start} -{' '}
                                {geofence.allowedHours.end}
                              </p>
                            )}
                            {geofence.allowedDays && geofence.allowedDays.length > 0 && (
                              <p>
                                Jours: {geofence.allowedDays.map((d) => DAY_NAMES_FULL[d]).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Polygon>
                  );
                })}

                {/* Couche de dessin */}
                <DrawingLayer
                  isDrawing={isDrawing}
                  points={drawnPoints}
                  onAddPoint={addPoint}
                  color={drawColor}
                />
              </MapContainer>
            </div>
          </div>

          {/* Liste des geofences */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">Zones configurées</h2>
              </div>
              <div className="p-3 space-y-2 max-h-[540px] overflow-y-auto">
                {isLoading && geofences.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                    Chargement...
                  </div>
                ) : geofences.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>Aucune zone configurée</p>
                    <p className="text-xs mt-1">
                      Cliquez sur "Nouvelle zone" pour commencer
                    </p>
                  </div>
                ) : (
                  geofences.map((geofence) => (
                    <GeofenceCard
                      key={geofence._id}
                      geofence={geofence}
                      isSelected={selectedGeofence?._id === geofence._id}
                      onSelect={() => handleSelectGeofence(geofence)}
                      onEdit={() => handleEdit(geofence)}
                      onDelete={() => setDeletingGeofence(geofence)}
                      onToggleActive={() => handleToggleActive(geofence)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <GeofenceFormModal
        isOpen={isFormOpen}
        editingGeofence={editingGeofence}
        drawnPoints={drawnPoints}
        onSubmit={editingGeofence ? handleUpdate : handleCreate}
        onClose={() => {
          setIsFormOpen(false);
          setEditingGeofence(null);
          setDrawnPoints([]);
        }}
        isLoading={isLoading}
      />

      <DeleteConfirmModal
        geofence={deletingGeofence}
        onConfirm={handleDelete}
        onCancel={() => setDeletingGeofence(null)}
        isLoading={isLoading}
      />
    </div>
  );
}

export default GeofencesPage;

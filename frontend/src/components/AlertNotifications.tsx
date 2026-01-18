import React, { useEffect, useCallback } from 'react';
import { toast, Toaster, Toast } from 'react-hot-toast';
import { useAlertStore } from '@/stores';
import { wsService } from '@/services';
import { AlertNotification, AlertSeverity, AlertType } from '@/types';
import { AlertTriangle, Bell, X, CheckCircle, Eye } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================
// Configuration des styles par sévérité
// ============================================

const severityConfig: Record<AlertSeverity, {
  bgColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
  icon: typeof AlertTriangle;
}> = {
  [AlertSeverity.INFO]: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    iconColor: 'text-blue-500',
    textColor: 'text-blue-800',
    icon: Bell,
  },
  [AlertSeverity.WARNING]: {
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    iconColor: 'text-yellow-500',
    textColor: 'text-yellow-800',
    icon: AlertTriangle,
  },
  [AlertSeverity.CRITICAL]: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-400',
    iconColor: 'text-red-500',
    textColor: 'text-red-800',
    icon: AlertTriangle,
  },
};

const alertTypeLabels: Record<AlertType, string> = {
  [AlertType.GEOFENCE_EXIT]: 'Sortie de zone',
  [AlertType.MOVEMENT_OUTSIDE_HOURS]: 'Mouvement hors horaires',
  [AlertType.BATTERY_LOW]: 'Batterie faible',
  [AlertType.DEVICE_OFFLINE]: 'Tracker hors ligne',
  [AlertType.SPEED_EXCEEDED]: 'Vitesse excessive',
  [AlertType.POTENTIAL_THEFT]: 'Vol potentiel',
};

// ============================================
// Toast personnalisé pour les alertes
// ============================================

interface AlertToastProps {
  notification: AlertNotification;
  t: Toast;
  onAcknowledge: (id: string) => void;
  onDismiss: () => void;
}

function AlertToast({ notification, t, onAcknowledge, onDismiss }: AlertToastProps) {
  const { alert, vehicle } = notification;
  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'max-w-md w-full pointer-events-auto rounded-lg border shadow-lg overflow-hidden',
        config.bgColor,
        config.borderColor,
        t.visible ? 'animate-enter' : 'animate-leave',
        alert.severity === AlertSeverity.CRITICAL && 'animate-pulse'
      )}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className={clsx('flex-shrink-0', config.iconColor)}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="ml-3 flex-1">
            <div className="flex items-center justify-between">
              <p className={clsx('text-sm font-semibold', config.textColor)}>
                {alertTypeLabels[alert.type]}
              </p>
              <button
                onClick={onDismiss}
                className="rounded-full p-1 hover:bg-black/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-700">{alert.message}</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {vehicle.name} • {vehicle.registrationNumber}
              </p>
              <button
                onClick={() => onAcknowledge(alert._id)}
                className={clsx(
                  'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                  'bg-white/80 hover:bg-white transition-colors',
                  config.textColor
                )}
              >
                <Eye className="w-3 h-3" />
                Acquitter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Bandeau d'alerte critique
// ============================================

interface CriticalAlertBannerProps {
  alerts: AlertNotification[];
  onAcknowledge: (id: string) => void;
}

export function CriticalAlertBanner({ alerts, onAcknowledge }: CriticalAlertBannerProps) {
  const criticalAlerts = alerts.filter(
    (n) => n.alert.severity === AlertSeverity.CRITICAL && n.alert.status === 'active'
  );

  if (criticalAlerts.length === 0) return null;

  return (
    <div className="bg-red-600 text-white">
      <div className="max-w-7xl mx-auto py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 animate-bounce" />
            <div>
              <p className="font-bold">
                {criticalAlerts.length} alerte{criticalAlerts.length > 1 ? 's' : ''} critique
                {criticalAlerts.length > 1 ? 's' : ''}!
              </p>
              <p className="text-sm text-red-100">
                {criticalAlerts[0].vehicle.name} - {criticalAlerts[0].alert.message.slice(0, 100)}
                {criticalAlerts[0].alert.message.length > 100 ? '...' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAcknowledge(criticalAlerts[0].alert._id)}
              className="flex items-center gap-1 px-4 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Prendre en compte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Hook pour les notifications d'alertes
// ============================================

export function useAlertNotifications(): void {
  const { acknowledgeAlert, addAlert } = useAlertStore();

  const handleNewAlert = useCallback(
    (notification: AlertNotification) => {
      addAlert(notification);

      // Afficher un toast selon la sévérité
      const { alert } = notification;

      // Son d'alerte pour les alertes critiques
      if (alert.severity === AlertSeverity.CRITICAL) {
        // Jouer un son d'alerte (si supporté)
        try {
          const audio = new Audio('/alert-sound.mp3');
          audio.play().catch(() => {});
        } catch {
          // Ignorer si pas de support audio
        }
      }

      // Afficher le toast
      toast.custom(
        (t) => (
          <AlertToast
            notification={notification}
            t={t}
            onAcknowledge={(id) => {
              acknowledgeAlert(id);
              toast.dismiss(t.id);
            }}
            onDismiss={() => toast.dismiss(t.id)}
          />
        ),
        {
          duration: alert.severity === AlertSeverity.CRITICAL ? Infinity : 10000,
          position: 'top-right',
        }
      );
    },
    [addAlert, acknowledgeAlert]
  );

  useEffect(() => {
    // S'abonner aux nouvelles alertes via WebSocket
    const unsubscribe = wsService.onNewAlert(handleNewAlert);
    return unsubscribe;
  }, [handleNewAlert]);
}

// ============================================
// Composant AlertNotificationProvider
// ============================================

export function AlertNotificationProvider({ children }: { children: React.ReactNode }) {
  useAlertNotifications();

  return (
    <>
      <Toaster
        position="top-right"
        containerStyle={{
          top: 80, // Espace pour le header
        }}
        toastOptions={{
          duration: 5000,
        }}
      />
      {children}
    </>
  );
}

// ============================================
// Panneau de liste des alertes actives
// ============================================

interface AlertListPanelProps {
  className?: string;
}

export function AlertListPanel({ className }: AlertListPanelProps) {
  const { alerts, fetchAlerts, acknowledgeAlert, resolveAlert } = useAlertStore();

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const activeAlerts = alerts.filter((a) => a.status !== 'resolved');

  return (
    <div className={clsx('bg-white rounded-lg shadow-lg', className)}>
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Alertes actives
          {activeAlerts.length > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
              {activeAlerts.length}
            </span>
          )}
        </h3>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {activeAlerts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
            <p>Aucune alerte active</p>
          </div>
        ) : (
          <div className="divide-y">
            {activeAlerts.map((alert) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;
              const vehicle = typeof alert.vehicleId === 'object' ? alert.vehicleId : null;

              return (
                <div
                  key={alert._id}
                  className={clsx('p-4 hover:bg-gray-50 transition-colors', {
                    'bg-red-50': alert.severity === AlertSeverity.CRITICAL,
                  })}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={clsx('w-5 h-5 mt-0.5', config.iconColor)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={clsx('text-sm font-medium', config.textColor)}>
                          {alertTypeLabels[alert.type]}
                        </span>
                        <span
                          className={clsx('px-1.5 py-0.5 rounded text-xs', {
                            'bg-red-100 text-red-700': alert.status === 'active',
                            'bg-yellow-100 text-yellow-700': alert.status === 'acknowledged',
                          })}
                        >
                          {alert.status === 'active' ? 'Active' : 'Prise en compte'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">{alert.message}</p>
                      {vehicle && (
                        <p className="text-xs text-gray-500 mt-1">
                          {vehicle.name} • {vehicle.registrationNumber}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(alert.triggeredAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        {alert.status === 'active' && (
                          <button
                            onClick={() => acknowledgeAlert(alert._id)}
                            className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                          >
                            Acquitter
                          </button>
                        )}
                        <button
                          onClick={() => resolveAlert(alert._id)}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                        >
                          Résoudre
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AlertNotificationProvider;

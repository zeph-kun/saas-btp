import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck,
  ArrowLeft,
  Building2,
  Bell,
  Shield,
  Edit3,
  CheckCircle,
  Users,
  FileText,
  Lock,
} from 'lucide-react';
import { UserMenu } from '@/components';
import { useAuthStore } from '@/stores';
import { UserRole } from '@/types';

// ============================================
// Types
// ============================================

type TabId = 0 | 1 | 2;

interface NotifPrefs {
  criticalAlerts: boolean;
  geofenceAlerts: boolean;
  batteryLow: boolean;
  newContracts: boolean;
  vehicleUpdates: boolean;
}

// ============================================
// Bannière succès réutilisable
// ============================================

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
      <CheckCircle className="w-4 h-4" />
      {message}
    </div>
  );
}

// ============================================
// Onglet 0 : Organisation
// ============================================

function TabOrganisation() {
  const { user } = useAuthStore();

  const [editingOrg, setEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState('Mon Organisation');
  const [orgSuccess, setOrgSuccess] = useState(false);

  const isAdmin =
    user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const handleSaveOrg = () => {
    setTimeout(() => {
      setOrgSuccess(true);
      setEditingOrg(false);
      setTimeout(() => setOrgSuccess(false), 3000);
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Informations de l'organisation
        </h2>

        {orgSuccess && (
          <SuccessBanner message="Organisation mise à jour avec succès" />
        )}

        {editingOrg ? (
          /* ── Mode édition ── */
          <div className="space-y-4">
            <div>
              <label
                htmlFor="org-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nom de l'organisation
              </label>
              <input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveOrg}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Enregistrer
              </button>
              <button
                onClick={() => setEditingOrg(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          /* ── Mode lecture ── */
          <div className="space-y-4">
            {/* Nom */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Nom de l'organisation</span>
              <span className="font-medium text-gray-900">{orgName}</span>
            </div>

            {/* Identifiant organisation */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Identifiant organisation</span>
              <span className="font-mono text-sm text-gray-500">
                {user?.organizationId}
              </span>
            </div>

            {/* Plan */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Plan</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                Plan Starter
              </span>
            </div>

            {/* Bouton modifier ou avertissement */}
            <div className="pt-2">
              {isAdmin ? (
                <button
                  onClick={() => setEditingOrg(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Edit3 className="w-4 h-4" /> Modifier
                </button>
              ) : (
                <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  Seuls les administrateurs peuvent modifier ces paramètres.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Statistiques ── */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <Users className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">1</p>
            <p className="text-sm text-gray-500">Membres</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <Truck className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">Véhicules</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <FileText className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">Contrats actifs</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Onglet 1 : Notifications
// ============================================

interface NotifRow {
  key: keyof NotifPrefs;
  label: string;
  description: string;
}

const NOTIF_ROWS: NotifRow[] = [
  {
    key: 'criticalAlerts',
    label: 'Alertes critiques',
    description: 'Être notifié immédiatement des alertes critiques',
  },
  {
    key: 'geofenceAlerts',
    label: 'Sorties de geofence',
    description: "Notification lors d'une sortie de zone autorisée",
  },
  {
    key: 'batteryLow',
    label: 'Batterie faible',
    description: "Alerte quand la batterie d'un tracker est faible",
  },
  {
    key: 'newContracts',
    label: 'Nouveaux contrats',
    description: "Notification lors de la création d'un contrat",
  },
  {
    key: 'vehicleUpdates',
    label: 'Mises à jour véhicules',
    description: 'Changements de statut des véhicules',
  },
];

function TabNotifications() {
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    criticalAlerts: true,
    geofenceAlerts: true,
    batteryLow: false,
    newContracts: true,
    vehicleUpdates: false,
  });
  const [notifSaved, setNotifSaved] = useState(false);

  const handleSave = () => {
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Préférences de notification
      </h2>

      {notifSaved && (
        <SuccessBanner message="Préférences enregistrées avec succès" />
      )}

      <div>
        {NOTIF_ROWS.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{row.label}</p>
              <p className="text-xs text-gray-500">{row.description}</p>
            </div>
            <button
              onClick={() =>
                setNotifPrefs((p) => ({ ...p, [row.key]: !p[row.key] }))
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifPrefs[row.key] ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifPrefs[row.key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        className="mt-6 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
      >
        Enregistrer les préférences
      </button>
    </div>
  );
}

// ============================================
// Onglet 2 : Sécurité
// ============================================

interface SessionRow {
  device: string;
  location: string;
  lastActivity: string;
  isCurrent: boolean;
}

const SESSIONS: SessionRow[] = [
  {
    device: 'Chrome — Windows 10',
    location: 'Paris, France',
    lastActivity: 'Il y a 2 minutes',
    isCurrent: true,
  },
  {
    device: 'Firefox — MacOS',
    location: 'Lyon, France',
    lastActivity: 'Il y a 3 heures',
    isCurrent: false,
  },
  {
    device: 'Safari — iPhone',
    location: 'Marseille, France',
    lastActivity: 'Il y a 2 jours',
    isCurrent: false,
  },
];

function TabSecurity() {
  const { user } = useAuthStore();
  return (
    <div className="space-y-6">
      {/* ── Sessions actives ── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Sessions actives
          </h2>
          <p className="text-sm text-gray-500">
            Appareils actuellement connectés à votre compte
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="pb-3 pr-4">Appareil</th>
                <th className="pb-3 pr-4">Localisation</th>
                <th className="pb-3 pr-4">Dernière activité</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SESSIONS.map((session) => (
                <tr key={session.device}>
                  <td className="py-3 pr-4 text-gray-900">{session.device}</td>
                  <td className="py-3 pr-4 text-gray-500">
                    {session.location}
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
                    {session.lastActivity}
                  </td>
                  <td className="py-3">
                    {session.isCurrent ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Session actuelle
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          window.alert('Fonctionnalité bientôt disponible')
                        }
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Révoquer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Authentification à deux facteurs ── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Authentification à deux facteurs
          </h2>
          <span className={`px-2 py-1 text-xs rounded-full ${user?.mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {user?.mfaEnabled ? 'Activé' : 'Non configuré'}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Ajoutez une couche de sécurité supplémentaire à votre compte avec une application TOTP.
        </p>
        <Link
          to="/profile"
          className="inline-flex px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Gérer dans mon profil
        </Link>
      </div>

      {/* ── Journaux d'audit ── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Journaux d'audit
        </h2>
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Lock className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 mb-3">Disponible dans la version Pro</p>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
            Pro
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Composant principal : SettingsPage
// ============================================

interface TabConfig {
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { label: 'Organisation', icon: <Building2 className="w-4 h-4" /> },
  { label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { label: 'Sécurité', icon: <Shield className="w-4 h-4" /> },
];

export function SettingsPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>(0);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Header ── */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Truck className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">SaaS BTP</h1>
                <p className="text-sm text-gray-500">
                  Paramètres &amp; configuration
                </p>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Bouton retour */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Tableau de bord
        </Link>

        {/* ── Navigation par onglets ── */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-1" role="tablist" aria-label="Sections des paramètres">
            {TABS.map((tab, idx) => {
              const tabIdx = idx as TabId;
              const isActive = activeTab === tabIdx;
              return (
                <button
                  key={tab.label}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tabIdx)}
                  className={
                    isActive
                      ? 'flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600'
                      : 'flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                  }
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Contenu de l'onglet actif ── */}
        {activeTab === 0 && <TabOrganisation />}
        {activeTab === 1 && <TabNotifications />}
        {activeTab === 2 && <TabSecurity />}
      </main>
    </div>
  );
}

export default SettingsPage;

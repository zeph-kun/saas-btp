import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { authService } from '@/services';
import type { ChangePasswordRequest } from '@/types';
import { UserMenu } from '@/components';
import {
  Truck,
  User,
  Lock,
  Shield,
  ChevronLeft,
  Check,
  X,
  Eye,
  EyeOff,
  Calendar,
  Mail,
  Edit3,
  Save,
  AlertCircle,
  Smartphone,
  Copy,
} from 'lucide-react';

// ============================================
// Constantes : labels et catégories de permissions
// ============================================

const PERMISSION_LABELS: Record<string, string> = {
  'vehicles:read': 'Lecture',
  'vehicles:create': 'Création',
  'vehicles:update': 'Modification',
  'vehicles:delete': 'Suppression',
  'vehicles:location': 'Localisation',
  'geofences:read': 'Lecture',
  'geofences:create': 'Création',
  'geofences:update': 'Modification',
  'geofences:delete': 'Suppression',
  'alerts:read': 'Lecture',
  'alerts:acknowledge': 'Acquittement',
  'alerts:resolve': 'Résolution',
  'clients:read': 'Lecture',
  'clients:create': 'Création',
  'clients:update': 'Modification',
  'clients:delete': 'Suppression',
  'contracts:read': 'Lecture',
  'contracts:create': 'Création',
  'contracts:update': 'Modification',
  'contracts:delete': 'Suppression',
  'users:read': 'Lecture',
  'users:create': 'Création',
  'users:update': 'Modification',
  'users:delete': 'Suppression',
  'organization:settings': 'Paramètres',
};

const PERMISSION_CATEGORIES: Record<string, { label: string; prefix: string }> = {
  vehicles: { label: 'Véhicules', prefix: 'vehicles:' },
  geofences: { label: 'Geofences', prefix: 'geofences:' },
  alerts: { label: 'Alertes', prefix: 'alerts:' },
  clients: { label: 'Clients', prefix: 'clients:' },
  contracts: { label: 'Contrats', prefix: 'contracts:' },
  users: { label: 'Utilisateurs', prefix: 'users:' },
  organization: { label: 'Organisation', prefix: 'organization:' },
};

// ============================================
// Utilitaires
// ============================================

const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Administrateur',
    manager: 'Manager',
    operator: 'Opérateur',
  };
  return labels[role] ?? role;
};

const getRoleColor = (role: string): string => {
  const colors: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-800',
    admin: 'bg-blue-100 text-blue-800',
    manager: 'bg-green-100 text-green-800',
    operator: 'bg-gray-100 text-gray-800',
  };
  return colors[role] ?? 'bg-gray-100 text-gray-800';
};

const getInitials = (firstName: string, lastName: string): string =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

const formatDateFR = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

// ============================================
// Calcul de la force du mot de passe (même logique que RegisterPage)
// ============================================

type PasswordStrength = 'weak' | 'medium' | 'strong';

interface PasswordStrengthResult {
  level: PasswordStrength;
  score: number; // 0 | 1 | 2 | 3
  label: string;
}

function computePasswordStrength(password: string): PasswordStrengthResult {
  if (password.length === 0) return { level: 'weak', score: 0, label: '' };

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasLongLength = password.length >= 12;

  const criteriaMet = [hasMinLength, hasUppercase, hasLowercase, hasDigit].filter(Boolean).length;

  if (!hasMinLength || criteriaMet <= 2) return { level: 'weak', score: 1, label: 'Faible' };
  if (criteriaMet === 4 && !hasLongLength) return { level: 'medium', score: 2, label: 'Moyen' };
  return { level: 'strong', score: 3, label: 'Fort' };
}

// ============================================
// Sous-composant : indicateur de force du mot de passe
// ============================================

function PasswordStrengthIndicator({ password }: { password: string }) {
  const { score, label } = computePasswordStrength(password);
  if (password.length === 0) return null;

  const barColor: Record<number, string> = { 1: 'bg-red-500', 2: 'bg-orange-400', 3: 'bg-green-500' };
  const labelColor: Record<number, string> = { 1: 'text-red-600', 2: 'text-orange-500', 3: 'text-green-600' };

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= score ? (barColor[score] ?? 'bg-gray-200') : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${labelColor[score] ?? 'text-gray-500'}`}>{label}</p>
    </div>
  );
}

// ============================================
// Sous-composant : champ de mot de passe avec afficher/masquer
// ============================================

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  autoComplete?: string;
  showStrength?: boolean;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete = 'current-password',
  showStrength = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`block w-full px-3 py-2 pr-10 border rounded-lg text-sm text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors
            ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          aria-label={visible ? 'Masquer' : 'Afficher'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {showStrength && <PasswordStrengthIndicator password={value} />}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================
// Onglet 1 : Informations personnelles
// ============================================

function TabInfos() {
  const { user } = useAuthStore();

  // États du formulaire
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  // Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync si le user change dans le store (ex: après refreshUser)
  useEffect(() => {
    if (!isEditing && user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setEmail(user.email);
    }
  }, [user, isEditing]);

  const handleEdit = () => {
    // Initialiser avec les valeurs actuelles
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setEmail(user.email);
    }
    setSuccessMsg(null);
    setErrorMsg(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await authService.updateProfile({ firstName, lastName, email });
      await useAuthStore.getState().refreshUser();
      setIsEditing(false);
      setSuccessMsg('Profil mis à jour avec succès');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Bannière succès */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <Check className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Formulaire informations personnelles */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Informations personnelles</h2>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Modifier
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Erreur API */}
          {errorMsg && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Ligne Prénom + Nom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-firstName" className="block text-sm font-medium text-gray-700 mb-1">
                Prénom
              </label>
              {isEditing ? (
                <input
                  id="profile-firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <p className="px-3 py-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-100">
                  {user.firstName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="profile-lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Nom
              </label>
              {isEditing ? (
                <input
                  id="profile-lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <p className="px-3 py-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-100">
                  {user.lastName}
                </p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                Adresse email
              </span>
            </label>
            {isEditing ? (
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="px-3 py-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-100">
                {user.email}
              </p>
            )}
          </div>

          {/* Boutons en mode édition */}
          {isEditing && (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isSaving ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Enregistrer
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Informations de compte (lecture seule) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Informations de compte</h2>
        </div>

        <dl className="px-6 py-5 space-y-4">
          {/* Rôle */}
          <div className="flex items-center justify-between">
            <dt className="text-sm font-medium text-gray-500">Rôle</dt>
            <dd>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
            </dd>
          </div>

          {/* Date de création */}
          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              Membre depuis
            </dt>
            <dd className="text-sm text-gray-900">{formatDateFR(user.createdAt)}</dd>
          </div>

          {/* Dernière connexion */}
          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              Dernière connexion
            </dt>
            <dd className="text-sm text-gray-900">
              {user.lastLoginAt ? formatDateFR(user.lastLoginAt) : 'Jamais'}
            </dd>
          </div>

          {/* Organisation */}
          <div className="flex items-start justify-between gap-4">
            <dt className="text-sm font-medium text-gray-500 shrink-0">ID Organisation</dt>
            <dd className="text-sm text-gray-500 font-mono text-right break-all">{user.organizationId}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// ============================================
// Composant MFA
// ============================================

type MfaStep = 'idle' | 'setup' | 'verify' | 'backup' | 'disable';

function MfaSection() {
  const { user, refreshUser } = useAuthStore();
  const [step, setStep] = useState<MfaStep>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!user) return null;

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authService.mfaSetup();
      setQrCode(result.qrCodeDataUrl);
      setSecret(result.secret);
      setStep('setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const result = await authService.mfaEnable(totpCode);
      setBackupCodes(result.backupCodes);
      setStep('backup');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setIsLoading(false);
      setTotpCode('');
    }
  };

  const handleDisable = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await authService.mfaDisable(disablePassword);
      await refreshUser();
      setStep('idle');
      setSuccessMsg('Authentification à deux facteurs désactivée');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsLoading(false);
      setDisablePassword('');
    }
  };

  const handleFinishSetup = () => {
    setStep('idle');
    setQrCode('');
    setSecret('');
    setBackupCodes([]);
    setSuccessMsg('Authentification à deux facteurs activée');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-gray-500" />
        <h2 className="text-base font-semibold text-gray-900">Authentification à deux facteurs (TOTP)</h2>
      </div>

      <div className="px-6 py-5">
        {successMsg && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            <Check className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* État idle */}
        {step === 'idle' && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Statut :{' '}
                <span className={user.mfaEnabled ? 'text-green-600 font-medium' : 'text-gray-500'}>
                  {user.mfaEnabled ? 'Activé' : 'Désactivé'}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {user.mfaEnabled
                  ? 'Un code TOTP est demandé à chaque connexion.'
                  : 'Ajoutez une couche de sécurité avec une application d\'authentification (Google Authenticator, Authy, etc.).'}
              </p>
            </div>
            {user.mfaEnabled ? (
              <button
                onClick={() => { setStep('disable'); setError(null); }}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
              >
                Désactiver
              </button>
            ) : (
              <button
                onClick={handleStartSetup}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Chargement...' : 'Activer'}
              </button>
            )}
          </div>
        )}

        {/* Étape 1 : QR Code */}
        {step === 'setup' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Scannez ce QR code avec votre application d'authentification :
            </p>
            <div className="flex justify-center">
              <img src={qrCode} alt="QR Code TOTP" className="w-48 h-48" />
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Ou entrez cette clé manuellement :</p>
              <code className="text-sm bg-gray-100 px-3 py-1.5 rounded font-mono select-all">
                {secret}
              </code>
            </div>
            <form onSubmit={handleVerify} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code de vérification
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="block w-full px-3 py-2 border rounded-lg text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('idle'); setError(null); }}
                  className="flex-1 px-4 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isLoading || totpCode.length !== 6}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Vérification...' : 'Activer le MFA'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Étape 2 : Codes de secours */}
        {step === 'backup' && (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-medium text-yellow-800">
                Conservez ces codes de secours en lieu sûr.
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Chaque code ne peut être utilisé qu'une seule fois si vous perdez l'accès à votre application d'authentification.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-center space-y-1">
              {backupCodes.map((code, i) => (
                <div key={i} className="text-gray-800">{code}</div>
              ))}
            </div>
            <button
              onClick={copyBackupCodes}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <Copy className="w-4 h-4" />
              Copier les codes
            </button>
            <button
              onClick={handleFinishSetup}
              className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              J'ai sauvegardé mes codes
            </button>
          </div>
        )}

        {/* Désactivation */}
        {step === 'disable' && (
          <form onSubmit={handleDisable} className="space-y-4">
            <p className="text-sm text-gray-700">
              Entrez votre mot de passe pour confirmer la désactivation du MFA.
            </p>
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              autoComplete="current-password"
              className="block w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Mot de passe"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep('idle'); setError(null); }}
                className="flex-1 px-4 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isLoading || !disablePassword}
                className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Désactivation...' : 'Confirmer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ============================================
// Onglet 2 : Sécurité
// ============================================

function TabSecurity() {
  const { user } = useAuthStore();

  // États changement de mot de passe
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Erreurs par champ
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  // Feedback global
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setNewPasswordError(null);
    setConfirmPasswordError(null);
    setApiError(null);
  };

  const handleSubmitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setNewPasswordError(null);
    setConfirmPasswordError(null);

    // Validation côté client
    let hasError = false;

    if (!PASSWORD_REGEX.test(newPassword)) {
      setNewPasswordError('Minimum 8 caractères avec au moins une majuscule, une minuscule et un chiffre');
      hasError = true;
    }

    if (newPassword !== confirmNewPassword) {
      setConfirmPasswordError('Les mots de passe ne correspondent pas');
      hasError = true;
    }

    if (hasError) return;

    setIsSaving(true);
    const payload: ChangePasswordRequest = { currentPassword, newPassword };

    try {
      await authService.changePassword(payload);
      setSuccessMsg('Mot de passe modifié avec succès');
      setTimeout(() => {
        setSuccessMsg(null);
        resetForm();
      }, 3000);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  // Groupement des permissions par catégorie
  const groupedPermissions = Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => {
    const perms = user.permissions.filter((p) => p.startsWith(cat.prefix));
    return { key, label: cat.label, permissions: perms };
  }).filter((g) => g.permissions.length > 0);

  return (
    <div className="space-y-6">
      {/* ── Section : changement de mot de passe ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Lock className="w-5 h-5 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Changer le mot de passe</h2>
        </div>

        <form onSubmit={handleSubmitPassword} className="px-6 py-5 space-y-5">
          {/* Bannière succès */}
          {successMsg && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <Check className="w-4 h-4 shrink-0" />
              {successMsg}
            </div>
          )}

          {/* Erreur API */}
          {apiError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {apiError}
            </div>
          )}

          {/* Mot de passe actuel */}
          <PasswordField
            id="current-password"
            label="Mot de passe actuel"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />

          {/* Nouveau mot de passe */}
          <PasswordField
            id="new-password"
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={(v) => {
              setNewPassword(v);
              setNewPasswordError(null);
            }}
            error={newPasswordError}
            autoComplete="new-password"
            showStrength
          />

          {/* Confirmer le nouveau mot de passe */}
          <PasswordField
            id="confirm-new-password"
            label="Confirmer le nouveau mot de passe"
            value={confirmNewPassword}
            onChange={(v) => {
              setConfirmNewPassword(v);
              setConfirmPasswordError(null);
            }}
            error={confirmPasswordError}
            autoComplete="new-password"
          />

          <div className="pt-1">
            <button
              type="submit"
              disabled={isSaving || !currentPassword || !newPassword || !confirmNewPassword}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isSaving ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <Lock className="w-4 h-4" />
              )}
              Mettre à jour le mot de passe
            </button>
          </div>
        </form>
      </div>

      {/* ── Section : Authentification à deux facteurs ── */}
      <MfaSection />

      {/* ── Section : permissions ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Permissions</h2>
        </div>

        <div className="px-6 py-5">
          {groupedPermissions.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucune permission assignée.</p>
          ) : (
            <div className="space-y-5">
              {groupedPermissions.map(({ key, label, permissions }) => (
                <div key={key}>
                  {/* Titre de catégorie */}
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {label}{' '}
                    <span className="font-normal normal-case text-gray-400">({permissions.length})</span>
                  </h3>

                  {/* Pills */}
                  <div className="flex flex-wrap gap-2">
                    {permissions.map((perm) => (
                      <span
                        key={perm}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 text-xs font-medium rounded-full"
                      >
                        <Check className="w-3 h-3" />
                        {PERMISSION_LABELS[perm] ?? perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Composant principal : ProfilePage
// ============================================

type Tab = 'infos' | 'security';

export function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('infos');

  // Redirection si non authentifié (protection côté composant)
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'infos',
      label: 'Informations',
      icon: <User className="w-4 h-4" />,
    },
    {
      id: 'security',
      label: 'Sécurité',
      icon: <Lock className="w-4 h-4" />,
    },
  ];

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
                <p className="text-sm text-gray-500">Gestion de flotte & télématique</p>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Lien retour */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Tableau de bord
          </Link>
        </div>

        {/* Grille principale : carte utilisateur + contenu */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* ── Colonne gauche : carte identité ── */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              {/* Avatar */}
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-600 text-white text-2xl font-bold mb-4">
                {getInitials(user.firstName, user.lastName)}
              </div>

              {/* Nom complet */}
              <h2 className="text-lg font-semibold text-gray-900 leading-tight">
                {user.firstName} {user.lastName}
              </h2>

              {/* Rôle */}
              <span
                className={`inline-flex items-center mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}
              >
                {getRoleLabel(user.role)}
              </span>

              {/* Email */}
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-gray-500 break-all">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {user.email}
              </p>

              {/* Membre depuis */}
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                Membre depuis {formatDateFR(user.createdAt)}
              </p>
            </div>
          </aside>

          {/* ── Colonne droite : onglets + contenu ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Navigation par onglets */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <nav className="flex" role="tablist" aria-label="Sections du profil">
                {tabs.map((tab, idx) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      'flex-1 inline-flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors',
                      idx === 0 ? 'rounded-tl-xl' : '',
                      idx === tabs.length - 1 ? 'rounded-tr-xl' : '',
                      activeTab === tab.id
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b-2 border-transparent',
                    ].join(' ')}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Contenu de l'onglet actif */}
            {activeTab === 'infos' && <TabInfos />}
            {activeTab === 'security' && <TabSecurity />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default ProfilePage;

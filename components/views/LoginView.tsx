
import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { PadelLogo, Input, Button, Divider } from '../UIComponents';
import { registerUser, loginUser } from '../../services/firebase';

interface LoginViewProps {
    currentUser: User | null;
    checkingTeam: boolean;
    teamId: string | null;
    handleCreateTeam: (name: string) => void;
    handleLogout: () => void;
    handleGuestLogin: (guestCode: string) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ 
    currentUser, checkingTeam, teamId, handleCreateTeam, handleLogout, handleGuestLogin 
}) => {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');
    const [teamName, setTeamName] = useState('');
    const [guestCode, setGuestCode] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [error, setError] = useState('');

    if (currentUser && !checkingTeam && !teamId) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 space-y-6">
              <div className="text-center">
                 <div className="w-16 h-16 bg-lime-100 dark:bg-lime-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                   <PadelLogo className="w-10 h-10" />
                 </div>
                 <h2 className="text-2xl font-black text-slate-900 dark:text-white">¡Casi listo!</h2>
                 <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Ponle nombre a tu equipo para empezar.</p>
              </div>
              <Input 
                 label="Nombre del Equipo" 
                 placeholder="Ej. Los Smashers" 
                 value={teamName}
                 onChange={(e) => setTeamName(e.target.value)}
              />
              <Button onClick={() => handleCreateTeam(teamName)} disabled={!teamName || authLoading} className="w-full" size="lg">
                🎾 Crear Equipo
              </Button>
              <Button variant="ghost" onClick={handleLogout} className="w-full text-sm">Cancelar / Cerrar Sesión</Button>
           </div>
        </div>
      );
    }
    
    if (currentUser && checkingTeam) {
        return (
          <div className="min-h-screen bg-blue-950 flex items-center justify-center flex-col gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-800 border-t-lime-400"></div>
            <p className="text-blue-300 text-sm font-medium">Cargando equipo...</p>
          </div>
        );
    }

    const handleAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (isRegister && password !== confirmPassword) {
          setError("Las contraseñas no coinciden");
          return;
      }
      setAuthLoading(true);
      try {
        if (isRegister) {
          await registerUser(email, password, name, surname);
        } else {
          await loginUser(email, password);
        }
      } catch (err: any) {
        const msg = err.message || '';
        if (msg.includes('invalid-credential') || msg.includes('wrong-password')) setError('Email o contraseña incorrectos.');
        else if (msg.includes('email-already-in-use')) setError('Este email ya está registrado.');
        else if (msg.includes('weak-password')) setError('La contraseña debe tener al menos 6 caracteres.');
        else setError('Error de autenticación. Inténtalo de nuevo.');
      } finally {
        setAuthLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-lime-400/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">
          {/* Logo section */}
          <div className="text-center mb-8">
            <div className="inline-flex bg-white/5 backdrop-blur-sm p-4 rounded-3xl shadow-2xl shadow-lime-400/10 border border-white/10 mb-4">
              <PadelLogo className="w-14 h-14" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">
              Padel <span className="text-lime-400">Stats</span>
            </h1>
            <p className="text-blue-300 text-sm mt-1 font-medium">Gestiona tu equipo de pádel</p>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {/* Tab selector */}
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              <button 
                type="button" 
                onClick={() => { setIsRegister(false); setError(''); }} 
                className={`flex-1 py-4 font-bold text-sm uppercase tracking-widest transition-all ${!isRegister ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                Iniciar Sesión
              </button>
              <button 
                type="button" 
                onClick={() => { setIsRegister(true); setError(''); }} 
                className={`flex-1 py-4 font-bold text-sm uppercase tracking-widest transition-all ${isRegister ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                Registrarse
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="p-8 space-y-4">
              {isRegister && (
                 <div className="grid grid-cols-2 gap-3">
                   <Input label="Nombre" placeholder="Juan" value={name} required onChange={(e) => setName(e.target.value)} />
                   <Input label="Apellido" placeholder="Pérez" value={surname} required onChange={(e) => setSurname(e.target.value)} />
                 </div>
              )}
              <Input label="Email" type="email" placeholder="juan@ejemplo.com" value={email} required onChange={(e) => setEmail(e.target.value)} />
              <Input label="Contraseña" type="password" placeholder="Mínimo 6 caracteres" value={password} required onChange={(e) => setPassword(e.target.value)} />
              {isRegister && (
                   <Input label="Confirmar Contraseña" type="password" placeholder="Repite la contraseña" value={confirmPassword} required onChange={(e) => setConfirmPassword(e.target.value)} />
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl px-4 py-3">
                  ⚠️ {error}
                </div>
              )}

              <Button type="submit" disabled={authLoading} className="w-full justify-center" size="lg">
                {authLoading ? (
                  <><div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" /> Cargando...</>
                ) : (
                  isRegister ? '🎾 Crear Cuenta' : 'Entrar al Panel'
                )}
              </Button>
            </form>

            <div className="px-8 pb-8">
              <Divider label="Invitados" />
              <div className="flex gap-2">
                <Input placeholder="ID del Equipo" value={guestCode} onChange={(e) => setGuestCode(e.target.value)} hint="Pide el código al capitán" />
                <Button variant="secondary" onClick={() => handleGuestLogin(guestCode)} disabled={!guestCode} className="flex-shrink-0">
                  Ver
                </Button>
              </div>
            </div>
          </div>

          <p className="text-center text-blue-400/50 text-xs mt-6 font-medium">
            Padel Stats Pro · Gestión de equipos
          </p>
        </div>
      </div>
    );
};

export default LoginView;

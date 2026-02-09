
import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { PadelLogo, Input, Button } from '../UIComponents';
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

    if (currentUser && !checkingTeam && !teamId) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6">
              <div className="text-center">
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white">¡Bienvenido, {currentUser.displayName}!</h2>
                 <p className="text-slate-500 dark:text-slate-400 mt-2">Solo queda un paso: crea tu equipo.</p>
              </div>
              <Input 
                 label="Nombre del Equipo" 
                 placeholder="Ej. Los Smashers" 
                 value={teamName}
                 onChange={(e) => setTeamName(e.target.value)}
              />
              <Button onClick={() => handleCreateTeam(teamName)} disabled={!teamName || authLoading} className="w-full">
                Crear Equipo
              </Button>
              <Button variant="ghost" onClick={handleLogout} className="w-full">Cancelar / Cerrar Sesión</Button>
           </div>
        </div>
      );
    }
    
    if (currentUser && checkingTeam) {
        return <div className="min-h-screen bg-blue-950 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div></div>;
    }

    const handleAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isRegister && password !== confirmPassword) {
          alert("Las contraseñas no coinciden");
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
        alert("Error de autenticación: " + err.message);
      } finally {
        setAuthLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border-t-4 border-lime-400">
          <div className="flex justify-center mb-8">
             <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl shadow-xl shadow-lime-400/10">
                <PadelLogo className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-center text-slate-900 dark:text-white uppercase tracking-tight mb-2">Padel Stats <span className="text-lime-500">Pro</span></h1>
          <form onSubmit={handleAuthSubmit} className="space-y-4 mt-8">
            <div className="flex border-b border-slate-100 dark:border-slate-800 mb-6">
              <button type="button" onClick={() => setIsRegister(false)} className={`flex-1 py-3 font-bold text-sm uppercase tracking-wider transition-colors ${!isRegister ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Iniciar Sesión</button>
              <button type="button" onClick={() => setIsRegister(true)} className={`flex-1 py-3 font-bold text-sm uppercase tracking-wider transition-colors ${isRegister ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Registrarse</button>
            </div>
            {isRegister && (
               <div className="grid grid-cols-2 gap-3">
                 <Input label="Nombre" placeholder="Juan" value={name} required onChange={(e) => setName(e.target.value)} />
                 <Input label="Apellido" placeholder="Pérez" value={surname} required onChange={(e) => setSurname(e.target.value)} />
               </div>
            )}
            <Input label="Email" type="email" placeholder="juan@ejemplo.com" value={email} required onChange={(e) => setEmail(e.target.value)} />
            <Input label="Contraseña" type="password" placeholder="********" value={password} required onChange={(e) => setPassword(e.target.value)} />
            {isRegister && (
                 <Input label="Confirmar Contraseña" type="password" placeholder="********" value={confirmPassword} required onChange={(e) => setConfirmPassword(e.target.value)} />
            )}
            <Button type="submit" disabled={authLoading} className="w-full justify-center h-12 text-base">
              {authLoading ? 'Cargando...' : (isRegister ? 'Crear Cuenta' : 'Entrar')}
            </Button>
          </form>
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest text-slate-400"><span className="px-2 bg-white dark:bg-slate-900">Invitados</span></div>
          </div>
          <div className="flex gap-2">
            <Input placeholder="ID del Equipo" value={guestCode} onChange={(e) => setGuestCode(e.target.value)} />
            <Button variant="secondary" onClick={() => handleGuestLogin(guestCode)} disabled={!guestCode}>Entrar</Button>
          </div>
        </div>
      </div>
    );
};

export default LoginView;
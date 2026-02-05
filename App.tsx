import React, { useState, useEffect } from 'react';
import { 
  Users, Trophy, Calendar, Settings, LogOut, LayoutGrid, ChevronRight, ChevronDown, X, Camera, Edit2, Trash2, Plus, Menu
} from './components/Icons';
import { 
  Player, AppState, ViewState, Position, MatchDay, MatchLineup, MatchResult
} from './types';
import { 
  auth, 
  logoutUser, 
  createTeam, 
  subscribeToTeam, 
  getTeamIdForUser, 
  updateTeamData 
} from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

// New Imports
import { DEFAULT_SETTINGS, DEFAULT_SEASON, TANDA_OPTIONS } from './utils/constants';
import { compressImage, recalculateStats } from './utils/helpers';
import { Button, Input, Select, Checkbox, PadelLogo } from './components/UIComponents';

// Views
import LoginView from './components/views/LoginView';
import DashboardView from './components/views/DashboardView';
import PlayersView from './components/views/PlayersView';
import MatchesView from './components/views/MatchesView';
import LineupView from './components/views/LineupView';
import SettingsView from './components/views/SettingsView';

const App = () => {
  // --- Global State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [checkingTeam, setCheckingTeam] = useState(true); 
  const [data, setData] = useState<AppState | null>(null); 
  const [isLoading, setIsLoading] = useState(true);
  
  // --- UI State ---
  const [currentView, setCurrentView] = useState<ViewState>('LOGIN');
  const [sessionRole, setSessionRole] = useState<'CAPTAIN' | 'GUEST'>('GUEST');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Season State
  const [viewSeasonId, setViewSeasonId] = useState<string>('all');

  // --- Modal/Form State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'ADD_PLAYER' | 'EDIT_PLAYER' | 'ADD_MATCH' | 'EDIT_MATCH' | 'EDIT_TEAM'>('ADD_PLAYER');
  const [importMode, setImportMode] = useState<'MANUAL' | 'BULK'>('MANUAL');
  
  // Temporary State for Forms
  const [tempPlayer, setTempPlayer] = useState<Partial<Player>>({});
  const [tempTeamName, setTempTeamName] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [tempPlayersList, setTempPlayersList] = useState<Partial<Player>[]>([]); 
  const [tempMatch, setTempMatch] = useState<Partial<MatchDay>>({
    date: new Date().toISOString(), 
    opponent: '',
    isHome: true, 
    lineups: [],
    tandas: '5' 
  });
  
  const [tempLineupScores, setTempLineupScores] = useState({
      player1Id: '', player2Id: '',
      opponent1Name: '', opponent2Name: '',
      s1We: '', s1They: '',
      s2We: '', s2They: '',
      s3We: '', s3They: ''
  });

  // --- Initialization & Auth Listener ---
  useEffect(() => {
    // Favicon is now handled statically in index.html

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setCheckingTeam(true); 
        const tid = await getTeamIdForUser(user.uid);
        if (tid) {
          setTeamId(tid);
          setSessionRole('CAPTAIN');
          setCurrentView('DASHBOARD');
        } else {
          setTeamId(null);
        }
        setCheckingTeam(false); 
      } else {
        setTeamId(null);
        setData(null);
        setCurrentView('LOGIN');
        setCheckingTeam(false);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Real-time Data Subscription ---
  useEffect(() => {
    if (teamId) {
      const unsubscribe = subscribeToTeam(teamId, (teamData) => {
        if (teamData) {
          if (!teamData.seasons || teamData.seasons.length === 0) {
              teamData.seasons = [DEFAULT_SEASON];
          }
          setData(teamData);
          
          if (viewSeasonId === 'all') {
              const active = teamData.seasons?.find(s => s.isActive);
              if (active) setViewSeasonId(active.id);
              else if (teamData.seasons && teamData.seasons.length > 0) setViewSeasonId(teamData.seasons[0].id);
              else setViewSeasonId('default');
          }

        } else {
          console.error("Team document not found");
        }
      });
      return () => unsubscribe();
    }
  }, [teamId]);

  // --- Actions ---

  const handleLogout = async () => {
    await logoutUser();
    setSessionRole('GUEST');
    setTeamId(null);
    setData(null);
    setCheckingTeam(false);
    setIsMobileMenuOpen(false);
  };

  const handleCreateTeam = async (name: string) => {
    if (!currentUser) return;
    try {
      setIsLoading(true);
      const newTeamId = await createTeam(currentUser, name, DEFAULT_SETTINGS);
      setTeamId(newTeamId);
      setSessionRole('CAPTAIN');
      setCurrentView('DASHBOARD');
    } catch (e) {
      console.error(e);
      alert("Error creando equipo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTeamName = async () => {
      if (!teamId || !tempTeamName) return;
      await updateTeamData(teamId, { teamName: tempTeamName });
      setIsModalOpen(false);
  };

  const handleGuestLogin = (guestTeamId: string) => {
    if (!guestTeamId) return;
    setTeamId(guestTeamId);
    setSessionRole('GUEST');
    setCurrentView('DASHBOARD');
  };

  const createPlayerObject = (p: Partial<Player>) : Player => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: p.name || 'Nuevo Jugador',
      surname: p.surname || '', 
      position: p.position || Position.AMBOS,
      level: 3.0,
      initialPoints: Number(p.initialPoints) || 0,
      handedness: p.handedness || 'right',
      matchesPlayed: 0,
      wins: 0,
      email: '',
      photoUrl: p.photoUrl
  });

  const addPlayer = async (player: Partial<Player>) => {
    if (!data || !teamId) return;
    const newPlayer = createPlayerObject(player);
    
    if (viewSeasonId !== 'all' && viewSeasonId !== 'default') {
         const updatedSeasons = [...(data.seasons || [])];
         const seasonIndex = updatedSeasons.findIndex(s => s.id === viewSeasonId);
         if (seasonIndex >= 0) {
             const points = Number(player.initialPoints) || 0;
             updatedSeasons[seasonIndex] = {
                 ...updatedSeasons[seasonIndex],
                 playerStartPoints: {
                     ...(updatedSeasons[seasonIndex].playerStartPoints || {}),
                     [newPlayer.id]: points
                 }
             };
             await updateTeamData(teamId, { seasons: updatedSeasons });
         }
    }

    const updatedPlayers = [...data.players, newPlayer];
    await updateTeamData(teamId, { players: updatedPlayers });
    setIsModalOpen(false);
  };

  const addPlayersBulk = async () => {
      if (!data || !teamId || tempPlayersList.length === 0) return;
      const newPlayers = tempPlayersList.map(p => createPlayerObject(p));
      
      if (viewSeasonId !== 'all' && viewSeasonId !== 'default') {
          const updatedSeasons = [...(data.seasons || [])];
          const seasonIndex = updatedSeasons.findIndex(s => s.id === viewSeasonId);
          if (seasonIndex >= 0) {
              const newPointsMap = { ...(updatedSeasons[seasonIndex].playerStartPoints || {}) };
              newPlayers.forEach(p => {
                  newPointsMap[p.id] = p.initialPoints;
              });
               updatedSeasons[seasonIndex] = {
                 ...updatedSeasons[seasonIndex],
                 playerStartPoints: newPointsMap
             };
             await updateTeamData(teamId, { seasons: updatedSeasons });
          }
      }

      const updatedPlayers = [...data.players, ...newPlayers];
      await updateTeamData(teamId, { players: updatedPlayers });
      setIsModalOpen(false);
      setTempPlayersList([]);
      setBulkText('');
  };

  const updatePlayer = async (player: Partial<Player>) => {
    if (!data || !teamId) return;
    const updatedPlayers = data.players.map(p => p.id === player.id ? { ...p, ...player } as Player : p);
    if (viewSeasonId !== 'all' && modalType === 'EDIT_PLAYER') {
         const updatedSeasons = [...(data.seasons || [])];
         const seasonIndex = updatedSeasons.findIndex(s => s.id === viewSeasonId);
         if (seasonIndex >= 0) {
             const points = Number(player.initialPoints) || 0;
             updatedSeasons[seasonIndex] = {
                 ...updatedSeasons[seasonIndex],
                 playerStartPoints: {
                     ...(updatedSeasons[seasonIndex].playerStartPoints || {}),
                     [player.id!]: points
                 }
             };
             await updateTeamData(teamId, { players: updatedPlayers, seasons: updatedSeasons });
             setIsModalOpen(false);
             return;
         }
    }
    await updateTeamData(teamId, { players: updatedPlayers });
    setIsModalOpen(false);
  };

  const deletePlayer = async (id: string) => {
    if (!data || !teamId) return;
    if (window.confirm('¿Seguro que quieres eliminar a este jugador?')) {
      const updatedPlayers = data.players.filter(p => p.id !== id);
      await updateTeamData(teamId, { players: updatedPlayers });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const compressed = await compressImage(file);
          setTempPlayer(prev => ({ ...prev, photoUrl: compressed }));
      } catch (err) {
          alert("Error subiendo imagen");
      }
  };

  const saveMatch = async () => {
    if (!data || !teamId) return;
    const activeSeason = data.seasons?.find(s => s.isActive) || DEFAULT_SEASON;
    const newMatchData: MatchDay = {
      id: tempMatch.id || Date.now().toString(), 
      date: tempMatch.date || new Date().toISOString(),
      opponent: tempMatch.opponent || 'Desconocido',
      isHome: tempMatch.isHome ?? true,
      lineups: tempMatch.lineups || [],
      notes: tempMatch.notes || undefined,
      tandas: tempMatch.tandas || '5',
      seasonId: tempMatch.seasonId || activeSeason.id 
    };
    let updatedMatches;
    if (modalType === 'EDIT_MATCH') {
        updatedMatches = data.matches.map(m => m.id === newMatchData.id ? newMatchData : m);
    } else {
        updatedMatches = [...data.matches, newMatchData];
    }
    const updatedPlayers = recalculateStats(data.players, updatedMatches);
    await updateTeamData(teamId, { matches: updatedMatches, players: updatedPlayers });
    setIsModalOpen(false);
  };

  const addLineupToTempMatch = () => {
      const { player1Id, player2Id, s1We, s1They, s2We, s2They, s3We, s3They, opponent1Name, opponent2Name } = tempLineupScores;
      if (!player1Id || !player2Id) {
          alert("Selecciona dos jugadores");
          return;
      }
      const calculateSetWinner = (left: string, right: string, isHome: boolean) => {
          const l = Number(left);
          const r = Number(right);
          if (isHome) {
              if (l > r) return 'win';
              if (l < r) return 'loss';
              return 'draw';
          } else {
              if (r > l) return 'win';
              if (r < l) return 'loss';
              return 'draw';
          }
      }
      let setsWon = 0;
      let setsLost = 0;
      const r1 = calculateSetWinner(s1We, s1They, tempMatch.isHome ?? true);
      if (r1 === 'win') setsWon++; else if (r1 === 'loss') setsLost++;
      const r2 = calculateSetWinner(s2We, s2They, tempMatch.isHome ?? true);
      if (r2 === 'win') setsWon++; else if (r2 === 'loss') setsLost++;
      if (s3We && s3They) {
         const r3 = calculateSetWinner(s3We, s3They, tempMatch.isHome ?? true);
         if (r3 === 'win') setsWon++; else if (r3 === 'loss') setsLost++;
      }
      let result = MatchResult.DRAW;
      if (setsWon > setsLost) result = MatchResult.WIN;
      else if (setsLost > setsWon) result = MatchResult.LOSS;
      const newLineup: MatchLineup = {
          player1Id,
          player2Id,
          opponent1Name: opponent1Name || undefined,
          opponent2Name: opponent2Name || undefined,
          set1: `${s1We}-${s1They}`,
          set2: `${s2We}-${s2They}`,
          result
      };
      if (s3We && s3They) {
          newLineup.set3 = `${s3We}-${s3They}`;
      }
      setTempMatch(prev => ({
          ...prev,
          lineups: [...(prev.lineups || []), newLineup]
      }));
      setTempLineupScores({
          player1Id: '', player2Id: '',
          opponent1Name: '', opponent2Name: '',
          s1We: '', s1They: '',
          s2We: '', s2They: '',
          s3We: '', s3They: ''
      });
  };

  const removeLineupFromTempMatch = (index: number) => {
      setTempMatch(prev => ({
          ...prev,
          lineups: prev.lineups?.filter((_, i) => i !== index)
      }));
  };

  const editLineupInTempMatch = (index: number) => {
      if (!tempMatch.lineups) return;
      const lineup = tempMatch.lineups[index];
      const [s1We, s1They] = (lineup.set1 || "0-0").split('-');
      const [s2We, s2They] = (lineup.set2 || "0-0").split('-');
      let s3We = '', s3They = '';
      if (lineup.set3) {
          [s3We, s3They] = lineup.set3.split('-');
      }
      setTempLineupScores({
          player1Id: lineup.player1Id,
          player2Id: lineup.player2Id,
          opponent1Name: lineup.opponent1Name || '',
          opponent2Name: lineup.opponent2Name || '',
          s1We: s1We || '', s1They: s1They || '',
          s2We: s2We || '', s2They: s2They || '',
          s3We: s3We || '', s3They: s3They || ''
      });
      removeLineupFromTempMatch(index);
  };

  const handleBulkTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBulkText(text);
    const lines = text.split(/\r?\n/);
    const parsedPlayers: Partial<Player>[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/[\t,;-]+/).map(p => p.trim());
        if (parts.length === 0) continue;
        const name = parts[0];
        if (!name) continue; 
        let position = Position.AMBOS;
        let handedness: 'right' | 'left' = 'right';
        let initialPoints = 0;
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i].toLowerCase();
            const partTrimmed = parts[i].trim();
            if (part.includes('drive')) position = Position.DRIVE;
            else if (part.includes('rev') || part.includes('back')) position = Position.REVES;
            else if (part.includes('izq') || part.includes('left') || part.includes('zurdo')) handedness = 'left';
            else if (part.includes('der') || part.includes('right') || part.includes('diestro')) handedness = 'right';
            else if (!isNaN(Number(partTrimmed)) && partTrimmed !== '') initialPoints = Number(partTrimmed);
        }
        parsedPlayers.push({ name, position, handedness, initialPoints });
    }
    setTempPlayersList(parsedPlayers);
  };

  const NavContent = () => (
      <div className="flex flex-col h-full">
         <div className="p-8"><h1 className="text-white font-black text-2xl flex items-center gap-2 tracking-tighter uppercase"><PadelLogo className="w-8 h-8" /> Padel Stats</h1><div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900 text-blue-200 uppercase border border-blue-800">{sessionRole}</div></div>
        {data && data.seasons && data.seasons.length > 0 && (
             <div className="px-6 mb-6"><div className="relative"><select style={{ backgroundColor: '#1e3a8a', color: 'white', appearance: 'none', MozAppearance: 'none', WebkitAppearance: 'none' }} value={viewSeasonId} onChange={(e) => setViewSeasonId(e.target.value)} className="w-full font-bold text-sm py-3 px-4 rounded-xl appearance-none border border-blue-800 outline-none focus:ring-2 focus:ring-lime-400 transition-all [color-scheme:dark]"><option value="all">Todas las Temporadas</option>{data.seasons.map(s => ( <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(Activa)' : ''}</option> ))}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-300 pointer-events-none" size={18} /></div></div>
        )}
        <nav className="flex-1 px-4 space-y-2">
          {[ { id: 'DASHBOARD', label: 'Inicio', icon: Trophy }, { id: 'PLAYERS', label: 'Plantilla', icon: Users }, { id: 'MATCHES', label: 'Jornadas', icon: Calendar }, { id: 'LINEUP', label: 'Alineación', icon: LayoutGrid }, { id: 'SETTINGS', label: 'Ajustes', icon: Settings, role: 'CAPTAIN' } ].map(item => {
             if (item.role && item.role !== sessionRole) return null;
             const isActive = currentView === item.id;
             return ( <button key={item.id} onClick={() => { setCurrentView(item.id as ViewState); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group ${isActive ? 'bg-lime-400 text-blue-950 shadow-lg shadow-lime-400/20' : 'hover:bg-blue-900 hover:text-white'}`}><item.icon size={22} className={isActive ? 'text-blue-950' : 'text-slate-400 group-hover:text-lime-400'} /><span className="font-bold text-xs uppercase tracking-wider">{item.label}</span>{isActive && <ChevronRight size={16} className="ml-auto opacity-50" />}</button> )
          })}
        </nav>
        <div className="p-6 border-t border-blue-900"><button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/10 rounded-xl transition-all text-xs font-black uppercase"><LogOut size={18} /> Salir de la Sesión</button></div>
      </div>
  );

  // --- View Rendering ---

  if (isLoading) return <div className="min-h-screen bg-blue-950 flex items-center justify-center text-lime-400 font-bold text-xl uppercase animate-pulse">Iniciando Padel Stats...</div>;
  
  if (!teamId && !currentUser) {
      return <LoginView currentUser={currentUser} checkingTeam={checkingTeam} teamId={teamId} handleCreateTeam={handleCreateTeam} handleLogout={handleLogout} handleGuestLogin={handleGuestLogin} />;
  }
  if (currentUser && !teamId) {
       return <LoginView currentUser={currentUser} checkingTeam={checkingTeam} teamId={teamId} handleCreateTeam={handleCreateTeam} handleLogout={handleLogout} handleGuestLogin={handleGuestLogin} />;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans text-slate-900">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-blue-950 p-4 flex justify-between items-center text-white shadow-md z-30 sticky top-0">
          <div className="flex items-center gap-2 font-black uppercase tracking-tight"><PadelLogo className="w-8 h-8"/> Padel Stats</div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-white"><Menu size={24}/></button>
      </div>

      {/* Mobile Menu Drawer (Overlay) */}
      {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
              <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
              <aside className="relative bg-blue-950 text-slate-400 w-72 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                 <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-4 right-4 text-slate-400 p-2"><X size={24}/></button>
                 <NavContent />
              </aside>
          </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex bg-blue-950 text-slate-400 w-72 flex-shrink-0 flex-col h-screen sticky top-0">
          <NavContent />
      </aside>

      <main className="flex-1 overflow-y-auto h-[calc(100vh-64px)] md:h-screen bg-slate-50 p-4 md:p-10">
        <div className="max-w-6xl mx-auto pb-20 md:pb-0">
            {currentView === 'DASHBOARD' && (
                <DashboardView 
                    data={data} 
                    sessionRole={sessionRole} 
                    viewSeasonId={viewSeasonId} 
                    teamId={teamId}
                    setTempTeamName={setTempTeamName}
                    setModalType={setModalType}
                    setIsModalOpen={setIsModalOpen}
                />
            )}
            {currentView === 'PLAYERS' && (
                <PlayersView 
                    data={data}
                    sessionRole={sessionRole}
                    viewSeasonId={viewSeasonId}
                    setTempPlayer={setTempPlayer}
                    setModalType={setModalType}
                    setImportMode={setImportMode}
                    setIsModalOpen={setIsModalOpen}
                    deletePlayer={deletePlayer}
                    setTempPlayersList={setTempPlayersList}
                />
            )}
            {currentView === 'MATCHES' && (
                <MatchesView 
                    data={data}
                    sessionRole={sessionRole}
                    viewSeasonId={viewSeasonId}
                    setTempMatch={setTempMatch}
                    setModalType={setModalType}
                    setIsModalOpen={setIsModalOpen}
                />
            )}
            {currentView === 'LINEUP' && (
                <LineupView 
                    data={data}
                    viewSeasonId={viewSeasonId}
                />
            )}
            {currentView === 'SETTINGS' && (
                <SettingsView 
                    data={data}
                    teamId={teamId}
                    viewSeasonId={viewSeasonId}
                    setViewSeasonId={setViewSeasonId}
                    sessionRole={sessionRole}
                    updateTeamData={updateTeamData}
                />
            )}
        </div>
      </main>
      
      {/* --- MODAL RENDERING LOGIC (Kept in App.tsx for state complexity reasons) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-blue-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-black text-xl text-slate-900 uppercase tracking-tighter">{modalType.includes('PLAYER') ? 'Gestionar Jugador' : modalType.includes('MATCH') ? 'Gestionar Jornada' : 'Editar Equipo'}</h3><button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 p-2"><X size={24} /></button></div>
            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                {modalType.includes('PLAYER') && ( <>
                        {modalType === 'ADD_PLAYER' && ( <div className="flex bg-slate-100 p-1 rounded-xl mb-4"><button className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${importMode === 'MANUAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`} onClick={() => setImportMode('MANUAL')}>Manual</button><button className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${importMode === 'BULK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`} onClick={() => setImportMode('BULK')}>Lista</button></div> )}
                        {importMode === 'MANUAL' ? ( <>
                                <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden relative cursor-pointer">{tempPlayer.photoUrl ? ( <img src={tempPlayer.photoUrl} className="w-full h-full object-cover" /> ) : ( <Camera className="text-slate-300" /> )}<input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handlePhotoUpload}/></div><div className="flex-1 space-y-4"><Input label="Nombre" value={tempPlayer.name || ''} onChange={e => setTempPlayer(p => ({...p, name: e.target.value}))} /><Input label="Apellido" value={tempPlayer.surname || ''} onChange={e => setTempPlayer(p => ({...p, surname: e.target.value}))} /></div></div>
                                <div className="grid grid-cols-2 gap-6"><Select label="Posición" value={tempPlayer.position || Position.AMBOS} onChange={e => setTempPlayer(p => ({...p, position: e.target.value as Position}))} options={[{label: 'Drive', value: Position.DRIVE},{label: 'Revés', value: Position.REVES},{label: 'Ambos', value: Position.AMBOS}]} /><Input type="number" label="Puntos Iniciales" value={tempPlayer.initialPoints || ''} onChange={e => setTempPlayer(p => ({...p, initialPoints: Number(e.target.value)}))} /></div>
                                <div className="pt-2"><Checkbox label="Es Zurdo" checked={tempPlayer.handedness === 'left'} onChange={(c) => setTempPlayer(p => ({...p, handedness: c ? 'left' : 'right'}))} /></div>
                            </> ) : ( <div className="space-y-6"><textarea className="w-full h-40 p-4 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-lime-400" placeholder="Nombre, Apellido, Posición, Puntos..." value={bulkText} onChange={handleBulkTextChange} /><div className="bg-lime-50 text-lime-700 p-3 rounded-xl text-xs font-bold border border-lime-200">{tempPlayersList.length} jugadores detectados automáticamente.</div></div> )}
                </> )}
                {(modalType === 'ADD_MATCH' || modalType === 'EDIT_MATCH') && ( <>
                        <div className="grid grid-cols-2 gap-4 items-end"><Input type="datetime-local" label="Fecha y Hora" value={tempMatch.date} onChange={e => setTempMatch(m => ({...m, date: e.target.value}))} /><div className="bg-slate-100 p-1 rounded-xl flex"><button className={`flex-1 py-3 text-xs font-black uppercase rounded-lg ${tempMatch.isHome ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`} onClick={() => setTempMatch(m => ({...m, isHome: true}))}>Casa</button><button className={`flex-1 py-3 text-xs font-black uppercase rounded-lg ${!tempMatch.isHome ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400'}`} onClick={() => setTempMatch(m => ({...m, isHome: false}))}>Fuera</button></div></div>
                        <div className="grid grid-cols-2 gap-4"><Input label="Rival" value={tempMatch.opponent} onChange={e => setTempMatch(m => ({...m, opponent: e.target.value}))} /><Select label="Tandas" value={tempMatch.tandas || '5'} onChange={(e) => setTempMatch(m => ({...m, tandas: e.target.value}))} options={TANDA_OPTIONS} /></div>
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mt-4"><h4 className="font-black text-xs uppercase text-slate-400 mb-6 tracking-widest">Partidos y Parejas</h4>
                            <div className="space-y-3 mb-6">{(tempMatch.lineups || []).map((l, i) => ( 
                                <div key={i} className="flex justify-between items-center p-4 rounded-xl text-sm shadow-sm border bg-white border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${l.result === MatchResult.WIN ? 'bg-lime-500' : l.result === MatchResult.LOSS ? 'bg-red-500' : 'bg-slate-400'}`}></div>
                                        <div>
                                            <div className="font-black text-slate-800">{data?.players.find(p => p.id === l.player1Id)?.name} / {data?.players.find(p => p.id === l.player2Id)?.name}</div>
                                            {l.opponent1Name && <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">vs {l.opponent1Name} / {l.opponent2Name}</div>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`font-mono font-black text-xs px-2 py-1 rounded shadow-sm ${l.result === MatchResult.WIN ? 'text-lime-700 bg-lime-100 border border-lime-200' : l.result === MatchResult.LOSS ? 'text-red-700 bg-red-100 border border-red-200' : 'text-blue-600 bg-blue-50 border border-blue-100'}`}>
                                            {l.set1} {l.set2} {l.set3}
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => editLineupInTempMatch(i)} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 size={16}/></button>
                                            <button onClick={() => removeLineupFromTempMatch(i)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                </div> 
                            ))}</div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <Select label="Jugador Drive" options={[{label: '...', value: ''}, ...(data?.players.map(p => ({label: `${p.name} ${p.surname || ''}`, value: p.id})) || [])]} value={tempLineupScores.player1Id} onChange={e => setTempLineupScores(l => ({...l, player1Id: e.target.value}))} />
                                    <Select label="Jugador Revés" options={[{label: '...', value: ''}, ...(data?.players.map(p => ({label: `${p.name} ${p.surname || ''}`, value: p.id})) || [])]} value={tempLineupScores.player2Id} onChange={e => setTempLineupScores(l => ({...l, player2Id: e.target.value}))} />
                                </div>
                                <div className="grid grid-cols-2 gap-3"><Input label="Rival 1 (Opcional)" value={tempLineupScores.opponent1Name} onChange={e => setTempLineupScores(l => ({...l, opponent1Name: e.target.value}))} /><Input label="Rival 2 (Opcional)" value={tempLineupScores.opponent2Name} onChange={e => setTempLineupScores(l => ({...l, opponent2Name: e.target.value}))} /></div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="flex flex-col gap-1 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase">Set 1</span><div className="flex gap-1"><input type="number" className="w-1/2 p-2 text-center bg-slate-50 border rounded-lg font-black" value={tempLineupScores.s1We} onChange={e => setTempLineupScores(l => ({...l, s1We: e.target.value}))} /><input type="number" className="w-1/2 p-2 text-center bg-slate-50 border rounded-lg font-black" value={tempLineupScores.s1They} onChange={e => setTempLineupScores(l => ({...l, s1They: e.target.value}))} /></div></div>
                                    <div className="flex flex-col gap-1 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase">Set 2</span><div className="flex gap-1"><input type="number" className="w-1/2 p-2 text-center bg-slate-50 border rounded-lg font-black" value={tempLineupScores.s2We} onChange={e => setTempLineupScores(l => ({...l, s2We: e.target.value}))} /><input type="number" className="w-1/2 p-2 text-center bg-slate-50 border rounded-lg font-black" value={tempLineupScores.s2They} onChange={e => setTempLineupScores(l => ({...l, s2They: e.target.value}))} /></div></div>
                                    <div className="flex flex-col gap-1 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase">Set 3</span><div className="flex gap-1"><input type="number" className="w-1/2 p-2 text-center bg-slate-50 border rounded-lg font-black" value={tempLineupScores.s3We} onChange={e => setTempLineupScores(l => ({...l, s3We: e.target.value}))} /><input type="number" className="w-1/2 p-2 text-center bg-slate-50 border rounded-lg font-black" value={tempLineupScores.s3They} onChange={e => setTempLineupScores(l => ({...l, s3They: e.target.value}))} /></div></div>
                                </div>
                                <Button variant="secondary" className="w-full text-xs font-black py-3 border-2 border-dashed border-blue-200 text-blue-600" onClick={addLineupToTempMatch}><Plus size={16}/> Añadir Pareja al Listado</Button>
                            </div>
                        </div>
                </> )}
                {modalType === 'EDIT_TEAM' && ( <Input label="Nuevo Nombre del Equipo" value={tempTeamName} onChange={(e) => setTempTeamName(e.target.value)} /> )}
            </div>
            <div className="p-6 bg-slate-100 flex justify-end gap-3"><Button variant="ghost" className="font-bold" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button className="px-10 h-12 font-black" onClick={() => { if (modalType === 'ADD_PLAYER') { if (importMode === 'MANUAL') addPlayer(tempPlayer); else addPlayersBulk(); } else if (modalType === 'EDIT_PLAYER') updatePlayer(tempPlayer); else if (modalType === 'ADD_MATCH' || modalType === 'EDIT_MATCH') saveMatch(); else if (modalType === 'EDIT_TEAM') handleUpdateTeamName(); }}>Guardar Cambios</Button></div>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
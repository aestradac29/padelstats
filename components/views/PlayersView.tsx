import React, { useState } from 'react';
import { LayoutGrid, List, ArrowUpDown, Edit2, Hand, Trash2, Plus } from '../Icons';
import { Button, Card } from '../UIComponents';
import { AppState, Player, Position, MatchResult, MatchDay } from '../../types';

interface PlayersViewProps {
    data: AppState | null;
    sessionRole: 'CAPTAIN' | 'GUEST';
    viewSeasonId: string;
    setTempPlayer: (p: Partial<Player>) => void;
    setModalType: (t: any) => void;
    setImportMode: (m: 'MANUAL' | 'BULK') => void;
    setIsModalOpen: (o: boolean) => void;
    deletePlayer: (id: string) => void;
    setTempPlayersList: (l: any[]) => void;
}

// Exporting this to be used by other views if needed, though simpler to duplicate small logic in refactor or use utils
export const getPoints = (p: Player, matchesContext: MatchDay[], seasonId: string, data: AppState) => {
    if (!data) return 0;
    let calculatedPoints = p.initialPoints || 0;
    let currentSettings = data.settings;
    if (seasonId !== 'all') {
        const season = data.seasons?.find(s => s.id === seasonId);
        if (season) {
            if (season.playerStartPoints && typeof season.playerStartPoints[p.id] !== 'undefined') {
                calculatedPoints = season.playerStartPoints[p.id];
            } else {
                if (seasonId !== 'default') calculatedPoints = 0;
            }
            if (season.settings) {
                currentSettings = season.settings;
            }
        }
    }
    const sortedMatches = [...matchesContext].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (currentSettings.scoringSystem === 'RANGES' && currentSettings.ranges) {
        sortedMatches.forEach(match => {
            let played = false;
            let result: MatchResult | undefined;
            for (const lineup of match.lineups) {
                if (lineup.player1Id === p.id || lineup.player2Id === p.id) {
                    played = true;
                    result = lineup.result;
                    break;
                }
            }
            if (played && result) {
                const range = currentSettings.ranges.find(r => calculatedPoints >= r.min && calculatedPoints <= r.max);
                if (range) {
                    if (result === MatchResult.WIN) calculatedPoints += range.win;
                    else if (result === MatchResult.LOSS) calculatedPoints -= range.loss;
                } else {
                    if (result === MatchResult.WIN) calculatedPoints += currentSettings.pointsPerWin;
                    else if (result === MatchResult.LOSS) calculatedPoints -= currentSettings.pointsPerLoss;
                }
            }
        });
    } else {
        sortedMatches.forEach(match => {
            match.lineups.forEach(lineup => {
                if (lineup.player1Id === p.id || lineup.player2Id === p.id) {
                    calculatedPoints += currentSettings.pointsAttendance;
                    if (lineup.result === MatchResult.WIN) calculatedPoints += currentSettings.pointsPerWin;
                    else if (lineup.result === MatchResult.LOSS) calculatedPoints += currentSettings.pointsPerLoss;
                    else if (lineup.result === MatchResult.DRAW) calculatedPoints += currentSettings.pointsPerDraw;
                }
            });
        });
    }
    return Math.max(0, calculatedPoints);
};

const PlayersView: React.FC<PlayersViewProps> = ({ 
    data, sessionRole, viewSeasonId, setTempPlayer, setModalType, setImportMode, setIsModalOpen, deletePlayer, setTempPlayersList 
}) => {
    const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
    const [sortField, setSortField] = useState<string>('points');

    if (!data) return null;

    const getFilteredMatches = () => {
        if (!data) return [];
        if (viewSeasonId === 'all') return data.matches;
        return data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));
    };
    
    const matches = getFilteredMatches();
    const playersStats = data.players.map(p => {
        let wins = 0;
        let matchesPlayed = 0;
        matches.forEach(m => {
            m.lineups.forEach(l => {
                if (l.player1Id === p.id || l.player2Id === p.id) {
                    matchesPlayed++;
                    if (l.result === MatchResult.WIN) wins++;
                }
            });
        });
        return {
            ...p,
            matchesPlayed,
            wins,
            points: getPoints(p, matches, viewSeasonId, data) 
        };
    });

    const sortedPlayers = [...playersStats].sort((a, b) => {
        if (sortField === 'points') return (b.points || 0) - (a.points || 0);
        if (sortField === 'winRate') {
             const wa = a.matchesPlayed ? a.wins / a.matchesPlayed : 0;
             const wb = b.matchesPlayed ? b.wins / b.matchesPlayed : 0;
             return wb - wa;
        }
        if (sortField === 'matches') return b.matchesPlayed - a.matchesPlayed;
        if (sortField === 'wins') return b.wins - a.wins;
        return 0;
    });

    const getInitialPointsForEdit = (pid: string) => {
        // Fallback logic: If season points are undefined, default to global initialPoints instead of 0
        if (viewSeasonId === 'all') {
            const p = data.players.find(pl => pl.id === pid);
            return p?.initialPoints || 0;
        } else {
            const season = data.seasons?.find(s => s.id === viewSeasonId);
            const p = data.players.find(pl => pl.id === pid);
            if (season?.playerStartPoints && typeof season.playerStartPoints[pid] !== 'undefined') {
                return season.playerStartPoints[pid];
            }
            return p?.initialPoints || 0;
        }
    };

    return (
    <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-300">
      <header className="flex justify-between items-center border-b border-slate-200 pb-4 md:pb-6">
        <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">Plantilla</h2>
        <div className="flex gap-2">
            <div className="bg-slate-100 p-1 rounded-lg flex items-center">
                <button onClick={() => setViewMode('CARDS')} className={`p-2 rounded-md transition-all ${viewMode === 'CARDS' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('TABLE')} className={`p-2 rounded-md transition-all ${viewMode === 'TABLE' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><List size={18} /></button>
            </div>
            {sessionRole === 'CAPTAIN' && (
            <Button onClick={() => { setTempPlayer({}); setTempPlayersList([]); setImportMode('MANUAL'); setModalType('ADD_PLAYER'); setIsModalOpen(true); }}><Plus size={18} /> <span className="hidden md:inline">Nuevo</span></Button>
            )}
        </div>
      </header>
      {viewMode === 'TABLE' ? (
          <div className="md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200/60 md:overflow-hidden">
             <div className="overflow-visible md:overflow-x-auto">
                <table className="w-full text-left text-sm border-separate border-spacing-y-4 md:border-spacing-0">
                    <thead className="hidden md:table-header-group bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="p-4 font-bold text-slate-500 uppercase tracking-wider">Jugador</th>
                            <th className="p-4 font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" onClick={() => setSortField('matches')}><div className="flex items-center gap-1">Partidos <ArrowUpDown size={12}/></div></th>
                            <th className="p-4 font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" onClick={() => setSortField('wins')}><div className="flex items-center gap-1">Victorias <ArrowUpDown size={12}/></div></th>
                            <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-red-400">Derrotas</th>
                            <th className="p-4 font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" onClick={() => setSortField('winRate')}><div className="flex items-center gap-1">% Vic <ArrowUpDown size={12}/></div></th>
                            <th className="p-4 font-bold text-slate-900 uppercase tracking-wider cursor-pointer hover:text-blue-600" onClick={() => setSortField('points')}><div className="flex items-center gap-1">Puntos <ArrowUpDown size={12}/></div></th>
                            {sessionRole === 'CAPTAIN' && <th className="p-4 text-right">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="md:divide-y md:divide-slate-100">
                        {sortedPlayers.map((player) => {
                             const winRate = player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0;
                             return (
                                 <tr key={player.id} className="bg-white md:bg-transparent shadow-sm md:shadow-none rounded-xl md:rounded-none flex flex-col md:table-row p-4 md:p-0 border border-slate-100 md:border-none relative hover:bg-slate-50 transition-colors">
                                     <td className="md:p-4 font-bold text-slate-900 flex items-center gap-3 mb-3 md:mb-0 border-b md:border-none border-slate-50 pb-3 md:pb-0">
                                          {player.photoUrl ? ( <img src={player.photoUrl} className="w-10 h-10 md:w-8 md:h-8 rounded-full object-cover" /> ) : ( <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">{player.name.charAt(0)}</div> )}
                                          <div className="flex flex-col md:flex-row md:gap-2">
                                            <span>{player.name} {player.surname}</span>
                                            <span className="md:hidden text-xs font-normal text-slate-400">{player.position}</span>
                                          </div>
                                     </td>
                                     
                                     {/* Mobile Grid for Stats */}
                                     <td className="md:hidden block mb-4">
                                         <div className="grid grid-cols-3 gap-2 text-center">
                                             <div className="bg-slate-50 p-2 rounded-lg">
                                                 <span className="text-[10px] text-slate-400 uppercase font-bold block">Partidos</span>
                                                 <span className="font-bold text-slate-700">{player.matchesPlayed}</span>
                                             </div>
                                             <div className="bg-slate-50 p-2 rounded-lg">
                                                 <span className="text-[10px] text-slate-400 uppercase font-bold block">Victorias</span>
                                                 <span className="font-bold text-lime-600">{player.wins}</span>
                                             </div>
                                             <div className="bg-slate-50 p-2 rounded-lg">
                                                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Puntos</span>
                                                  <span className="font-black text-blue-900">{player.points}</span>
                                             </div>
                                         </div>
                                     </td>

                                     <td className="hidden md:table-cell md:p-4 text-slate-600 font-medium">{player.matchesPlayed}</td>
                                     <td className="hidden md:table-cell md:p-4 text-lime-600 font-bold">{player.wins}</td>
                                     <td className="hidden md:table-cell md:p-4 text-red-500 font-medium">{player.matchesPlayed - player.wins}</td>
                                     <td className="md:table-cell p-0 md:p-4 mb-2 md:mb-0">
                                         <div className="flex items-center gap-2 justify-between md:justify-start">
                                            <span className="md:hidden text-xs font-bold text-slate-500 uppercase">Win Rate</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-700">{winRate}%</span>
                                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden md:block"><div className="h-full bg-blue-600" style={{width: `${winRate}%`}}></div></div>
                                            </div>
                                         </div>
                                         {/* Mobile Progress Bar */}
                                         <div className="md:hidden w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-blue-600" style={{width: `${winRate}%`}}></div></div>
                                     </td>
                                     <td className="hidden md:table-cell md:p-4 font-black text-lg text-slate-900">{player.points}</td>
                                     
                                     {sessionRole === 'CAPTAIN' && (
                                         <td className="md:table-cell md:p-4 text-right mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-none border-slate-50">
                                             <button onClick={() => { setTempPlayer({...player, initialPoints: getInitialPointsForEdit(player.id)}); setModalType('EDIT_PLAYER'); setImportMode('MANUAL'); setIsModalOpen(true); }} className="w-full md:w-auto p-2 text-blue-600 md:text-slate-400 hover:text-blue-600 bg-blue-50 md:bg-transparent rounded-lg md:rounded-none font-bold text-sm md:font-normal flex items-center justify-center gap-2">
                                                <Edit2 size={16}/> <span className="md:hidden">Editar Jugador</span>
                                             </button>
                                         </td>
                                     )}
                                 </tr>
                             )
                        })}
                    </tbody>
                </table>
             </div>
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {sortedPlayers.map((player, index) => {
                const winRate = player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0;
                return (
                    <Card key={player.id} className="relative group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-transparent border-t-0 md:border-t-4 md:border-l-0 md:hover:border-t-lime-400 border-slate-200 overflow-hidden p-3 md:p-6 flex flex-row md:flex-col items-center gap-3 md:gap-0">
                        {/* Mobile: Compact Row Layout */}
                        <div className="md:hidden absolute left-0 top-0 bottom-0 w-1 bg-lime-400"></div>
                        <div className="md:absolute md:top-0 md:left-0 md:bg-blue-600 md:text-white md:text-[10px] md:font-black md:px-2 md:py-1 md:rounded-br-lg md:shadow-sm md:z-10 hidden md:block">#{index + 1}</div>
                        
                        {/* Avatar & Name Section */}
                        <div className="flex items-center gap-3 md:gap-4 md:mb-4 md:mt-2 flex-1 md:flex-none w-full md:w-auto">
                            <div className="relative flex-shrink-0">
                                {player.photoUrl ? ( 
                                    <img src={player.photoUrl} alt={player.name} className="w-10 h-10 md:w-16 md:h-16 rounded-full object-cover border-2 md:border-4 border-slate-50 shadow-md" /> 
                                ) : ( 
                                    <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 flex items-center justify-center font-black text-sm md:text-xl border-2 md:border-4 border-slate-50 shadow-md">
                                        {player.name.charAt(0)}
                                    </div> 
                                )}
                                <div className={`absolute -bottom-1 -right-1 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide border border-white shadow-sm ${player.position === Position.REVES ? 'bg-orange-100 text-orange-700' : player.position === Position.DRIVE ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{player.position.substring(0, 1)}<span className="md:inline hidden">{player.position.substring(1, 3)}</span></div>
                            </div>
                            <div className="overflow-hidden min-w-0">
                                <h3 className="font-bold text-sm md:text-lg text-slate-900 truncate leading-tight">{player.name} <span className="hidden md:inline">{player.surname}</span></h3>
                                <div className="flex items-center gap-1 text-[10px] md:text-xs text-slate-400 font-medium">
                                    <span className="truncate">{player.matchesPlayed} PJ</span>
                                    {player.handedness === 'left' && <span className="text-lime-600 flex items-center gap-0.5 ml-1">• Zurdo</span>}
                                </div>
                            </div>
                        </div>

                        {/* Stats Section */}
                        <div className="flex md:grid md:grid-cols-2 gap-3 md:gap-4 items-center bg-transparent md:bg-slate-50 md:rounded-xl md:p-3 md:border md:border-slate-100 md:w-full">
                            <div className="flex flex-col md:block items-end md:items-start">
                                <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase block tracking-wider md:mb-1">Puntos</span>
                                <span className="text-sm md:text-xl font-black text-slate-900">{player.points}</span>
                            </div>
                            <div className="flex flex-col md:block items-end md:items-start w-12 md:w-auto">
                                <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase block tracking-wider md:mb-1">% Vic</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm md:text-xl font-black ${winRate >= 50 ? 'text-lime-600' : 'text-blue-600'}`}>{winRate}%</span>
                                </div>
                            </div>
                            <div className="col-span-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden hidden md:block"><div className="h-full bg-lime-400 rounded-full" style={{width: `${winRate}%`}}></div></div>
                        </div>

                        {/* Actions */}
                        {sessionRole === 'CAPTAIN' && (
                        <div className="md:flex gap-2 mt-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity hidden w-full">
                            <Button variant="secondary" className="flex-1 text-xs justify-center py-1 h-8 bg-white" onClick={() => { setTempPlayer({...player, initialPoints: getInitialPointsForEdit(player.id)}); setModalType('EDIT_PLAYER'); setImportMode('MANUAL'); setIsModalOpen(true); }}>Editar</Button>
                            <button className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors border border-red-100" onClick={() => deletePlayer(player.id)}><Trash2 size={14} /></button>
                        </div>
                        )}
                        {/* Mobile Actions: Click whole card to edit (Simplified for now, or just show summary) */}
                         {sessionRole === 'CAPTAIN' && (
                             <button className="md:hidden ml-2 text-slate-300" onClick={() => { setTempPlayer({...player, initialPoints: getInitialPointsForEdit(player.id)}); setModalType('EDIT_PLAYER'); setImportMode('MANUAL'); setIsModalOpen(true); }}>
                                 <Edit2 size={16} />
                             </button>
                         )}
                    </Card>
                )
            })}
        </div>
      )}
    </div>
  )};

export default PlayersView;


import React, { useState, useMemo } from 'react';
import { LayoutGrid, List, ArrowUpDown, Edit2, Trash2, Plus, AlertCircle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, MapPin, Trophy, TrendingUp } from '../Icons';
import { Button, Card } from '../UIComponents';
import { AppState, Player, Position, MatchResult, MatchDay } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

// Exporting this to be used by other views if needed
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
    
    // If scoring is disabled, just return initial/start points
    if (currentSettings.scoringSystem === 'NONE') {
        return calculatedPoints;
    }

    // Filter out ignored points matches before calculating score
    const matchesToScore = matchesContext.filter(m => !m.ignorePoints);
    const sortedMatches = [...matchesToScore].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
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
                // Clamp to zero after each match result so losses at 0 pts don't create "debt"
                calculatedPoints = Math.max(0, calculatedPoints);
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
                    
                    calculatedPoints = Math.max(0, calculatedPoints);
                }
            });
        });
    }
    return calculatedPoints;
};

const PlayersView: React.FC<PlayersViewProps> = ({ 
    data, sessionRole, viewSeasonId, setTempPlayer, setModalType, setImportMode, setIsModalOpen, deletePlayer, setTempPlayersList 
}) => {
    const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE' | 'EVOLUTION'>('TABLE');
    const [sortField, setSortField] = useState<string>('points');
    const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
    const [hiddenPlayers, setHiddenPlayers] = useState<Record<string, boolean>>({});

    if (!data) return null;

    const getFilteredMatches = () => {
        if (!data) return [];
        if (viewSeasonId === 'all') return data.matches;
        return data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));
    };
    
    const matches = getFilteredMatches();
    const matchesForStats = matches.filter(m => m.lineups && m.lineups.length > 0);
    
    const getInitialPointsForEdit = (pid: string) => {
        if (viewSeasonId === 'all') {
            const p = data.players.find(pl => pl.id === pid);
            return p?.initialPoints || 0;
        } else {
            const season = data.seasons?.find(s => s.id === viewSeasonId);
            const p = data.players.find(pl => pl.id === pid);
            if (season?.playerStartPoints && typeof season.playerStartPoints[pid] !== 'undefined') {
                return season.playerStartPoints[pid];
            }
            if (viewSeasonId === 'default') return p?.initialPoints || 0;
            return 0;
        }
    };

    // --- ADVANCED STATS CALCULATION ---
    const getSeasonEvolutionData = () => {
        if (!data) return [];
        
        // Initialize points for all players
        const currentPoints: Record<string, number> = {};
        data.players.forEach(p => {
            currentPoints[p.id] = getInitialPointsForEdit(p.id);
        });

        const evolutionData: any[] = [];
        
        // Initial state
        const initialDataPoint: any = { name: 'Inicio' };
        data.players.forEach(p => {
            initialDataPoint[p.id] = currentPoints[p.id];
        });
        evolutionData.push(initialDataPoint);

        const matchesToScore = matches.filter(m => !m.ignorePoints);
        const sortedMatches = [...matchesToScore].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        sortedMatches.forEach((match, index) => {
            // Determine settings for this match
            let matchSettings = data.settings;
            if (match.seasonId) {
                const season = data.seasons?.find(s => s.id === match.seasonId);
                if (season?.settings) matchSettings = season.settings;
            } else if (viewSeasonId !== 'all' && viewSeasonId !== 'default') {
                const season = data.seasons?.find(s => s.id === viewSeasonId);
                if (season?.settings) matchSettings = season.settings;
            }

            if (matchSettings.scoringSystem !== 'NONE') {
                data.players.forEach(p => {
                    let played = false;
                    let result: MatchResult | undefined;
                    let matchPointsAdded = 0;

                    match.lineups.forEach(lineup => {
                        if (lineup.player1Id === p.id || lineup.player2Id === p.id) {
                            played = true;
                            result = lineup.result;
                            if (matchSettings.scoringSystem === 'SIMPLE') {
                                matchPointsAdded += matchSettings.pointsAttendance;
                                if (result === MatchResult.WIN) matchPointsAdded += matchSettings.pointsPerWin;
                                else if (result === MatchResult.LOSS) matchPointsAdded += matchSettings.pointsPerLoss;
                                else if (result === MatchResult.DRAW) matchPointsAdded += matchSettings.pointsPerDraw;
                            }
                        }
                    });

                    if (played) {
                        if (matchSettings.scoringSystem === 'RANGES' && matchSettings.ranges && result) {
                            const range = matchSettings.ranges.find(r => currentPoints[p.id] >= r.min && currentPoints[p.id] <= r.max);
                            if (range) {
                                if (result === MatchResult.WIN) currentPoints[p.id] += range.win;
                                else if (result === MatchResult.LOSS) currentPoints[p.id] -= range.loss;
                            } else {
                                if (result === MatchResult.WIN) currentPoints[p.id] += matchSettings.pointsPerWin;
                                else if (result === MatchResult.LOSS) currentPoints[p.id] -= matchSettings.pointsPerLoss;
                            }
                        } else if (matchSettings.scoringSystem === 'SIMPLE') {
                            currentPoints[p.id] += matchPointsAdded;
                        }
                        currentPoints[p.id] = Math.max(0, currentPoints[p.id]);
                    }
                });
            }

            const dataPoint: any = { 
                name: `J${index + 1}`,
                fullDate: new Date(match.date).toLocaleDateString(),
                opponent: match.opponent
            };
            data.players.forEach(p => {
                dataPoint[p.id] = currentPoints[p.id];
            });
            evolutionData.push(dataPoint);
        });

        return evolutionData;
    };

    const evolutionData = useMemo(() => getSeasonEvolutionData(), [data, viewSeasonId, matches]);

    const playersStats = data.players.map(p => {
        let played = 0;
        let wins = 0;
        let losses = 0;
        let bench = 0;
        let unavailable = 0;
        
        let winsHome = 0;
        let playedHome = 0;
        let winsAway = 0;
        let playedAway = 0;

        matchesForStats.forEach(m => {
            const isPlayed = m.lineups.some(l => l.player1Id === p.id || l.player2Id === p.id);
            const isAvailable = (m.availablePlayers && m.availablePlayers.includes(p.id)) || isPlayed;

            if (isPlayed) {
                played++;
                const lineup = m.lineups.find(l => l.player1Id === p.id || l.player2Id === p.id);
                if (lineup) {
                    if (lineup.result === MatchResult.WIN) {
                        wins++;
                        if (m.isHome) winsHome++; else winsAway++;
                    } else if (lineup.result === MatchResult.LOSS) {
                        losses++;
                    }
                }
                if (m.isHome) playedHome++; else playedAway++;
            } else if (isAvailable) {
                bench++;
            } else {
                unavailable++;
            }
        });

        const totalPotentialMatches = matchesForStats.length; 
        const currentPoints = getPoints(p, matches, viewSeasonId, data);
        const initialPoints = getInitialPointsForEdit(p.id);
        const pointsDiff = currentPoints - initialPoints;
        
        return {
            ...p,
            stats: {
                played,
                wins,
                losses,
                bench,
                unavailable,
                playedHome,
                winsHome,
                playedAway,
                winsAway,
                total: totalPotentialMatches
            },
            points: currentPoints,
            pointsDiff: pointsDiff
        };
    });

    const sortedPlayers = [...playersStats].sort((a, b) => {
        if (sortField === 'points') return (b.points || 0) - (a.points || 0);
        if (sortField === 'winRate') {
             const wa = a.stats.played ? a.stats.wins / a.stats.played : 0;
             const wb = b.stats.played ? b.stats.wins / b.stats.played : 0;
             return wb - wa;
        }
        if (sortField === 'matches') return b.stats.played - a.stats.played;
        if (sortField === 'wins') return b.stats.wins - a.stats.wins;
        if (sortField === 'bench') return b.stats.bench - a.stats.bench;
        if (sortField === 'availability') {
             const availA = a.stats.played + a.stats.bench;
             const availB = b.stats.played + b.stats.bench;
             return availB - availA;
        }
        if (sortField === 'unavailable') return b.stats.unavailable - a.stats.unavailable;
        if (sortField === 'losses') return b.stats.losses - a.stats.losses;
        if (sortField === 'homeWinRate') {
             const wa = a.stats.playedHome ? a.stats.winsHome / a.stats.playedHome : 0;
             const wb = b.stats.playedHome ? b.stats.winsHome / b.stats.playedHome : 0;
             return wb - wa;
        }
        if (sortField === 'awayWinRate') {
             const wa = a.stats.playedAway ? a.stats.winsAway / a.stats.playedAway : 0;
             const wb = b.stats.playedAway ? b.stats.winsAway / b.stats.playedAway : 0;
             return wb - wa;
        }
        if (sortField === 'pointsDiff') return (b.pointsDiff || 0) - (a.pointsDiff || 0);
        return 0;
    });

    const toggleExpand = (id: string) => {
        setExpandedPlayerId(expandedPlayerId === id ? null : id);
    };

    const ProgressBar = ({ value, max, colorClass }: { value: number, max: number, colorClass: string }) => {
        const percent = max > 0 ? (value / max) * 100 : 0;
        return (
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }}></div>
            </div>
        );
    };

    const getRankStyle = (index: number) => {
        if (sortField !== 'points') return "text-slate-400 dark:text-slate-500 font-medium";
        if (index === 0) return "text-yellow-600 dark:text-yellow-400 font-black scale-110"; 
        if (index === 1) return "text-slate-500 dark:text-slate-300 font-black scale-105"; 
        if (index === 2) return "text-amber-700 dark:text-amber-500 font-black scale-105";
        return "text-slate-300 dark:text-slate-600 font-bold";
    };

    return (
    <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-300">
      <header className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4 md:pb-6 sticky top-0 bg-slate-50 dark:bg-slate-950 z-20 pt-2">
        <div>
            <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Estadísticas</h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 hidden md:block mt-1">Análisis detallado de rendimiento y disponibilidad</p>
        </div>
        <div className="flex gap-2">
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex items-center shadow-sm">
                <button onClick={() => setViewMode('CARDS')} className={`p-2 rounded-md transition-all ${viewMode === 'CARDS' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('TABLE')} className={`p-2 rounded-md transition-all ${viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><List size={18} /></button>
                <button onClick={() => setViewMode('EVOLUTION')} className={`p-2 rounded-md transition-all ${viewMode === 'EVOLUTION' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><TrendingUp size={18} /></button>
            </div>
            {sessionRole === 'CAPTAIN' && (
            <Button onClick={() => { setTempPlayer({}); setTempPlayersList([]); setImportMode('MANUAL'); setModalType('ADD_PLAYER'); setIsModalOpen(true); }} className="px-3 md:px-4"><Plus size={18} /> <span className="hidden md:inline">Nuevo</span></Button>
            )}
        </div>
      </header>
      
      {/* View Mode: TABLE (DETAILED STATS) - Adapted for Mobile as List */}
      {viewMode === 'TABLE' ? (
          <div className="md:bg-white md:dark:bg-slate-900 md:rounded-2xl md:shadow-sm md:border md:border-slate-200/60 md:dark:border-slate-800 md:overflow-hidden">
             
             {/* Desktop Table Header */}
             <div className="hidden md:block min-w-[1000px] overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center w-14">#</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">Jugador</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('availability')}>Disp.</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('matches')}>Jugados</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('bench')}>Banquillo</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('unavailable')}>No Disp.</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('wins')}>Vic</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('losses')}>Der</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('winRate')}>% Vic Global</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('homeWinRate')}>Casa (J / %)</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('awayWinRate')}>Fuera (J / %)</th>
                            <th className="p-4 font-bold text-slate-900 dark:text-white uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('points')}>Puntos</th>
                            <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSortField('pointsDiff')}>Dif.</th>
                            {sessionRole === 'CAPTAIN' && <th className="p-4 text-right"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedPlayers.map((player, index) => {
                             const s = player.stats;
                             const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
                             const winRateHome = s.playedHome > 0 ? Math.round((s.winsHome / s.playedHome) * 100) : 0;
                             const winRateAway = s.playedAway > 0 ? Math.round((s.winsAway / s.playedAway) * 100) : 0;
                             const availabilityPerc = s.total > 0 ? Math.round(((s.played + s.bench) / s.total) * 100) : 0;

                             return (
                                 <tr key={player.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                     <td className={`p-4 text-center ${getRankStyle(index)}`}>
                                         {index + 1}
                                     </td>
                                     <td className="p-4 font-bold text-slate-900 dark:text-white flex items-center gap-3 sticky left-0 bg-white dark:bg-slate-900 z-10 border-r md:border-none border-slate-50 dark:border-slate-800">
                                          {player.photoUrl ? ( <img src={player.photoUrl} className="w-8 h-8 rounded-full object-cover" /> ) : ( <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs">{player.name.charAt(0)}</div> )}
                                          <div>
                                            <span>{player.name} {player.surname}</span>
                                            <span className="block text-[10px] text-slate-400 font-normal">{player.position}</span>
                                          </div>
                                     </td>
                                     <td className="p-4 text-center"><span className={`font-bold ${availabilityPerc > 75 ? 'text-lime-600 dark:text-lime-400' : 'text-slate-500 dark:text-slate-400'}`}>{availabilityPerc}%</span><span className="text-[10px] text-slate-400 block">{s.played + s.bench}/{s.total}</span></td>
                                     <td className="p-4 text-center font-bold text-slate-800 dark:text-slate-200">{s.played}</td>
                                     <td className="p-4 text-center text-orange-500 font-medium">{s.bench}</td>
                                     <td className="p-4 text-center text-slate-300 dark:text-slate-600">{s.unavailable}</td>
                                     <td className="p-4 text-center text-lime-600 dark:text-lime-400 font-bold">{s.wins}</td>
                                     <td className="p-4 text-center text-red-400 font-medium">{s.losses}</td>
                                     <td className="p-4 text-center"><span className={`font-black ${winRate >= 50 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>{winRate}%</span></td>
                                     <td className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">{s.playedHome > 0 ? <span>{s.playedHome}J / <span className={winRateHome >= 50 ? 'text-lime-600 dark:text-lime-400 font-bold' : ''}>{winRateHome}%</span></span> : '-'}</td>
                                     <td className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">{s.playedAway > 0 ? <span>{s.playedAway}J / <span className={winRateAway >= 50 ? 'text-lime-600 dark:text-lime-400 font-bold' : ''}>{winRateAway}%</span></span> : '-'}</td>
                                     <td className="p-4 text-center font-black text-lg text-slate-900 dark:text-white">{player.points}</td>
                                     <td className="p-4 text-center">
                                         <span className={`text-xs font-bold ${player.pointsDiff > 0 ? 'text-lime-500' : player.pointsDiff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                             {player.pointsDiff > 0 ? '+' : ''}{player.pointsDiff}
                                         </span>
                                     </td>
                                     {sessionRole === 'CAPTAIN' && (
                                         <td className="p-4 text-right">
                                             <button onClick={() => { setTempPlayer({...player, initialPoints: getInitialPointsForEdit(player.id)}); setModalType('EDIT_PLAYER'); setImportMode('MANUAL'); setIsModalOpen(true); }} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit2 size={16}/></button>
                                         </td>
                                     )}
                                 </tr>
                             )
                        })}
                    </tbody>
                </table>
             </div>

             {/* Mobile Stacked List (Replament for Table) */}
             <div className="md:hidden space-y-3 pb-20">
                {sortedPlayers.map((player, index) => {
                    const s = player.stats;
                    const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
                    const isExpanded = expandedPlayerId === player.id;
                    const availabilityPerc = s.total > 0 ? Math.round(((s.played + s.bench) / s.total) * 100) : 0;

                    return (
                        <div key={player.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                            {/* Header Row */}
                            <div className="p-4 flex items-center justify-between cursor-pointer active:bg-slate-50 dark:active:bg-slate-800" onClick={() => toggleExpand(player.id)}>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs w-6 text-center ${getRankStyle(index)}`}>{index + 1}</span>
                                    <div className="relative">
                                        {player.photoUrl ? ( 
                                            <img src={player.photoUrl} className="w-10 h-10 rounded-full object-cover border border-slate-100 dark:border-slate-700" /> 
                                        ) : ( 
                                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center text-sm font-black border border-blue-100 dark:border-blue-800">
                                                {player.name.charAt(0)}
                                            </div> 
                                        )}
                                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold text-white uppercase ${player.position === Position.DRIVE ? 'bg-blue-500' : player.position === Position.REVES ? 'bg-orange-500' : 'bg-slate-500'}`}>
                                            {player.position.charAt(0)}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{player.name} {player.surname}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">{player.points} pts</span>
                                            <span className={`text-[10px] font-bold ${player.pointsDiff > 0 ? 'text-lime-500' : player.pointsDiff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                ({player.pointsDiff > 0 ? '+' : ''}{player.pointsDiff})
                                            </span>
                                            {s.played > 0 && (
                                                <span className={`text-[10px] font-bold ${winRate >= 50 ? 'text-lime-600 dark:text-lime-400' : 'text-slate-400'}`}>{winRate}% WR</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-slate-300 dark:text-slate-600">
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 p-4 animate-in slide-in-from-top-2 duration-200">
                                    
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                                            <span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Jugados</span>
                                            <span className="text-lg font-black text-slate-800 dark:text-white">{s.played}</span>
                                            <ProgressBar value={s.played} max={s.total} colorClass="bg-blue-500" />
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                                            <span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Victorias</span>
                                            <span className="text-lg font-black text-lime-600 dark:text-lime-400">{s.wins}</span>
                                            <ProgressBar value={s.wins} max={s.played} colorClass="bg-lime-500" />
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                                            <span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Disp.</span>
                                            <span className="text-lg font-black text-slate-800 dark:text-white">{availabilityPerc}%</span>
                                            <ProgressBar value={s.played + s.bench} max={s.total} colorClass="bg-indigo-500" />
                                        </div>
                                    </div>

                                    {/* Secondary Stats */}
                                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 px-1 mb-4">
                                        <div className="flex gap-4">
                                            <span className="flex items-center gap-1"><Clock size={12} className="text-orange-400"/> Banquillo: <strong>{s.bench}</strong></span>
                                            <span className="flex items-center gap-1"><XCircle size={12} className="text-slate-300"/> No Disp: <strong>{s.unavailable}</strong></span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-xs">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-slate-400 font-bold">Casa ({s.playedHome}J)</span>
                                                <span className={s.playedHome > 0 && (s.winsHome/s.playedHome) >= 0.5 ? 'text-lime-600 dark:text-lime-400 font-bold' : 'dark:text-slate-200'}>
                                                    {s.playedHome > 0 ? Math.round((s.winsHome/s.playedHome)*100) : 0}%
                                                </span>
                                            </div>
                                            <ProgressBar value={s.winsHome} max={s.playedHome} colorClass="bg-blue-400" />
                                        </div>
                                        <div className="flex-1 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-xs">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-slate-400 font-bold">Fuera ({s.playedAway}J)</span>
                                                <span className={s.playedAway > 0 && (s.winsAway/s.playedAway) >= 0.5 ? 'text-lime-600 dark:text-lime-400 font-bold' : 'dark:text-slate-200'}>
                                                    {s.playedAway > 0 ? Math.round((s.winsAway/s.playedAway)*100) : 0}%
                                                </span>
                                            </div>
                                            <ProgressBar value={s.winsAway} max={s.playedAway} colorClass="bg-orange-400" />
                                        </div>
                                    </div>

                                    {sessionRole === 'CAPTAIN' && (
                                        <div className="mt-4 flex gap-2">
                                            <Button variant="secondary" className="flex-1 h-9 text-xs" onClick={(e) => { e.stopPropagation(); setTempPlayer({...player, initialPoints: getInitialPointsForEdit(player.id)}); setModalType('EDIT_PLAYER'); setImportMode('MANUAL'); setIsModalOpen(true); }}>
                                                <Edit2 size={14} /> Editar
                                            </Button>
                                            <button className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 p-2 rounded-lg" onClick={(e) => { e.stopPropagation(); deletePlayer(player.id); }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
             </div>

          </div>
      ) : viewMode === 'EVOLUTION' ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 p-4 md:p-6 mb-20">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Evolución de Puntos</h3>
                  <div className="flex gap-2 w-full md:w-auto">
                      <Button 
                          variant="secondary" 
                          className="flex-1 md:flex-none text-xs py-1 px-3"
                          onClick={() => {
                              const allHidden: Record<string, boolean> = {};
                              sortedPlayers.forEach(p => allHidden[p.id] = true);
                              setHiddenPlayers(allHidden);
                          }}
                      >
                          Ocultar Todos
                      </Button>
                      <Button 
                          variant="secondary" 
                          className="flex-1 md:flex-none text-xs py-1 px-3"
                          onClick={() => setHiddenPlayers({})}
                      >
                          Mostrar Todos
                      </Button>
                  </div>
              </div>
              <div className="h-[500px] md:h-[600px] w-full overflow-x-auto">
                  <div className="min-w-[700px] h-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={evolutionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickMargin={10} />
                              <YAxis stroke="#64748b" fontSize={12} tickMargin={10} />
                              <Tooltip 
                                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                                  itemStyle={{ fontSize: '12px' }}
                                  labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}
                                  formatter={(value: number, name: string) => [`${value} pts`, name]}
                                  labelFormatter={(label, payload) => {
                                      if (payload && payload.length > 0) {
                                          const data = payload[0].payload;
                                          if (data.fullDate) {
                                              return `${label} - ${data.fullDate}${data.opponent ? ` vs ${data.opponent}` : ''}`;
                                          }
                                      }
                                      return label;
                                  }}
                              />
                              <Legend 
                                  wrapperStyle={{ fontSize: '12px', paddingTop: '20px', cursor: 'pointer' }} 
                                  onClick={(e: any) => {
                                      if (e && typeof e.dataKey === 'string') {
                                          setHiddenPlayers(prev => ({
                                              ...prev,
                                              [e.dataKey]: !prev[e.dataKey]
                                          }));
                                      }
                                  }}
                              />
                              {sortedPlayers.map((player, index) => (
                                  <Line 
                                      key={player.id} 
                                      type="monotone" 
                                      dataKey={player.id} 
                                      name={player.name} 
                                      stroke={`hsl(${(index * 137.5) % 360}, 70%, 50%)`} 
                                      strokeWidth={2}
                                      dot={{ r: 3, strokeWidth: 2 }}
                                      activeDot={{ r: 6 }}
                                      hide={hiddenPlayers[player.id]}
                                  />
                              ))}
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 pb-20">
            {sortedPlayers.map((player, index) => {
                const s = player.stats;
                const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
                return (
                    <Card key={player.id} className="relative group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-transparent border-t-0 md:border-t-4 md:border-l-0 md:hover:border-t-lime-400 border-slate-200 dark:border-slate-700 overflow-hidden p-3 md:p-6 flex flex-col gap-4">
                        <div className="md:hidden absolute left-0 top-0 bottom-0 w-1 bg-lime-400"></div>
                        <div className="md:absolute md:top-0 md:left-0 md:bg-blue-600 md:text-white md:text-[10px] md:font-black md:px-2 md:py-1 md:rounded-br-lg md:shadow-sm md:z-10 block">#{index + 1}</div>
                        
                        {/* Avatar & Name Section */}
                        <div className="flex items-center gap-3 md:gap-4 w-full">
                            <div className="relative flex-shrink-0">
                                {player.photoUrl ? ( 
                                    <img src={player.photoUrl} alt={player.name} className="w-10 h-10 md:w-16 md:h-16 rounded-full object-cover border-2 md:border-4 border-slate-50 dark:border-slate-700 shadow-md" /> 
                                ) : ( 
                                    <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 text-blue-800 dark:text-blue-200 flex items-center justify-center font-black text-sm md:text-xl border-2 md:border-4 border-slate-50 dark:border-slate-700 shadow-md">
                                        {player.name.charAt(0)}
                                    </div> 
                                )}
                                <div className={`absolute -bottom-1 -right-1 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide border border-white dark:border-slate-800 shadow-sm ${player.position === Position.REVES ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : player.position === Position.DRIVE ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>{player.position.substring(0, 1)}<span className="md:inline hidden">{player.position.substring(1, 3)}</span></div>
                            </div>
                            <div className="overflow-hidden min-w-0">
                                <h3 className="font-bold text-sm md:text-lg text-slate-900 dark:text-white truncate leading-tight">{player.name} <span className="hidden md:inline">{player.surname}</span></h3>
                                <div className="flex items-center gap-3 text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
                                    <span className="flex items-center gap-1"><CheckCircle size={10} className="text-lime-500"/> {s.played} Jug</span>
                                    <span className="flex items-center gap-1"><Clock size={10} className="text-orange-500"/> {s.bench} Banq</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats Section */}
                        <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                             <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase block">Puntos</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-lg font-black text-slate-900 dark:text-white">{player.points}</span>
                                    <span className={`text-[10px] font-bold ${player.pointsDiff > 0 ? 'text-lime-500' : player.pointsDiff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                        {player.pointsDiff > 0 ? '+' : ''}{player.pointsDiff}
                                    </span>
                                </div>
                             </div>
                             <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase block">% Victoria</span>
                                <span className={`text-lg font-black ${winRate >= 50 ? 'text-lime-600 dark:text-lime-400' : 'text-blue-600 dark:text-blue-400'}`}>{winRate}%</span>
                             </div>
                             <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800 mt-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                 <span>Casa: <strong className={s.playedHome > 0 && (s.winsHome/s.playedHome) > 0.5 ? 'text-lime-600 dark:text-lime-400' : ''}>{s.playedHome > 0 ? Math.round((s.winsHome/s.playedHome)*100) : 0}%</strong></span>
                                 <span>Fuera: <strong className={s.playedAway > 0 && (s.winsAway/s.playedAway) > 0.5 ? 'text-lime-600 dark:text-lime-400' : ''}>{s.playedAway > 0 ? Math.round((s.winsAway/s.playedAway)*100) : 0}%</strong></span>
                             </div>
                        </div>

                        {/* Actions */}
                        {sessionRole === 'CAPTAIN' && (
                        <div className="md:flex gap-2 mt-auto opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity hidden w-full">
                            <Button variant="secondary" className="flex-1 text-xs justify-center py-1 h-8 bg-white dark:bg-slate-800" onClick={() => { setTempPlayer({...player, initialPoints: getInitialPointsForEdit(player.id)}); setModalType('EDIT_PLAYER'); setImportMode('MANUAL'); setIsModalOpen(true); }}>Editar</Button>
                            <button className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-100 dark:border-red-900" onClick={() => deletePlayer(player.id)}><Trash2 size={14} /></button>
                        </div>
                        )}
                         {sessionRole === 'CAPTAIN' && (
                             <button className="md:hidden ml-auto text-slate-300 absolute top-4 right-4" onClick={() => { setTempPlayer({...player, initialPoints: getInitialPointsForEdit(player.id)}); setModalType('EDIT_PLAYER'); setImportMode('MANUAL'); setIsModalOpen(true); }}>
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
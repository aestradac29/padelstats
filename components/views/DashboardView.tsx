import React, { useState, useEffect } from 'react';
import { Edit2, UserPlus, Trophy, BrainCircuit, Activity, Calendar, Sparkles } from '../Icons';
import { Card, Button } from '../UIComponents';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AppState, MatchResult, Player, MatchDay } from '../../types';
import { analyzeTeamStats, AIAnalysisResult } from '../../services/geminiService';
import { getPoints } from './PlayersView';

interface DashboardViewProps {
    data: AppState | null;
    sessionRole: 'CAPTAIN' | 'GUEST';
    viewSeasonId: string;
    teamId: string | null;
    setTempTeamName: (name: string) => void;
    setModalType: (type: any) => void;
    setIsModalOpen: (isOpen: boolean) => void;
}

// Re-implementing helper here since it depends on AppState context often
const getPointsLocal = (p: Player, data: AppState, seasonId: string) => {
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
             if (season.settings) currentSettings = season.settings;
        }
    }
    
    // If scoring is disabled, just return initial/start points
    if (currentSettings.scoringSystem === 'NONE') {
        return calculatedPoints;
    }

    const matches = data.matches.filter(m => m.seasonId === seasonId || (!m.seasonId && seasonId === 'default') || seasonId === 'all');
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

const DashboardView: React.FC<DashboardViewProps> = ({ 
    data, sessionRole, viewSeasonId, teamId, setTempTeamName, setModalType, setIsModalOpen 
}) => {
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
    const [loadingAi, setLoadingAi] = useState(false);
    
    // Filter helpers
    const getFilteredMatches = () => {
        if (!data) return [];
        if (viewSeasonId === 'all') return data.matches;
        return data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));
    };

    const getFilteredStats = () => {
        if (!data) return [];
        const matches = getFilteredMatches();
        return data.players.map(p => {
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
                points: getPointsLocal(p, data, viewSeasonId) 
            };
        });
    };

    const stats = getFilteredStats();
    const filteredMatches = getFilteredMatches();
    
    // Calculate Match Day results (Win/Loss/Draw based on majority sets)
    const getMatchDayResult = (m: MatchDay) => {
        if (!m.lineups || m.lineups.length === 0) return 'PENDING';
        
        const wins = m.lineups.filter(l => l.result === MatchResult.WIN).length;
        const losses = m.lineups.filter(l => l.result === MatchResult.LOSS).length;
        if (wins > losses) return 'WIN';
        if (losses > wins) return 'LOSS';
        return 'DRAW';
    };

    // Derived Stats
    const playedMatches = filteredMatches.filter(m => m.lineups && m.lineups.length > 0);
    const matchDaysTotal = filteredMatches.length;
    const matchDaysPlayedCount = playedMatches.length;

    const matchDaysWon = playedMatches.filter(m => getMatchDayResult(m) === 'WIN').length;
    
    // Win Rates (Based only on PLAYED matches)
    const matchDaysWinRate = matchDaysPlayedCount > 0 ? Math.round((matchDaysWon / matchDaysPlayedCount) * 100) : 0;
    
    const totalLineupsPlayed = playedMatches.reduce((acc, m) => acc + (m.lineups?.length || 0), 0);
    const totalLineupsWonDirect = playedMatches.reduce((acc, m) => acc + m.lineups.filter(l => l.result === MatchResult.WIN).length, 0);
    const matchesWinRate = totalLineupsPlayed > 0 ? Math.round((totalLineupsWonDirect / totalLineupsPlayed) * 100) : 0;

    // Reset analysis when data or season changes to avoid stale data
    useEffect(() => {
        setAiAnalysis(null);
    }, [viewSeasonId, data?.matches.length]);

    const handleRunAnalysis = () => {
        if (!data) return;
        setLoadingAi(true);
        
        // 1. Calculate Home vs Away Performance (Only Played)
        const homeMatches = playedMatches.filter(m => m.isHome);
        const awayMatches = playedMatches.filter(m => !m.isHome);
        
        const homeWins = homeMatches.filter(m => getMatchDayResult(m) === 'WIN').length;
        const awayWins = awayMatches.filter(m => getMatchDayResult(m) === 'WIN').length;

        // 2. Calculate Recent Streak (Last 5 Played)
        // Sort Newest -> Oldest first to get the last 5
        const sortedMatchesDesc = [...playedMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Get the last 5 results
        let recentResults = sortedMatchesDesc.slice(0, 5).map(m => getMatchDayResult(m));
        
        // REVERSE it so it reads chronologically (Oldest -> Newest) for the AI context
        const chronologicalStreak = [...recentResults].reverse(); 

        // 3. Find MVP (Most points)
        const activePlayers = stats.filter(p => p.matchesPlayed > 0);
        const mvpPlayer = activePlayers.length > 0 ? activePlayers.reduce((prev, current) => (prev.points > current.points) ? prev : current) : null;

        // 4. Construct Full Context
        const context = {
            teamName: data.teamName,
            seasonId: viewSeasonId,
            totalScheduledMatches: matchDaysTotal,
            matchesPlayed: matchDaysPlayedCount,
            matchDaysRecord: {
                won: matchDaysWon,
                lost: playedMatches.filter(m => getMatchDayResult(m) === 'LOSS').length,
                draw: playedMatches.filter(m => getMatchDayResult(m) === 'DRAW').length,
            },
            individualMatchesRecord: {
                total: totalLineupsPlayed,
                won: totalLineupsWonDirect,
                lost: totalLineupsPlayed - totalLineupsWonDirect,
            },
            performanceSplit: {
                home: `${homeWins} victorias de ${homeMatches.length} jugados`,
                away: `${awayWins} victorias de ${awayMatches.length} jugados`,
            },
            recentStreakChronological: chronologicalStreak.length > 0 ? chronologicalStreak.join(' -> ') : "Sin partidos jugados", 
            mvpPlayer: mvpPlayer ? `${mvpPlayer.name} (${mvpPlayer.points} pts)` : 'N/A (Nadie ha jugado aún)'
        };

        analyzeTeamStats(context)
            .then(setAiAnalysis)
            .finally(() => setLoadingAi(false));
    };

    if (!data) return <div>Cargando...</div>;
    const chartData = stats.map(p => ({ name: p.name, points: p.points })).sort((a, b) => b.points - a.points).slice(0, 5);
    
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-200 pb-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{sessionRole === 'CAPTAIN' ? `Hola, ${data.captainName}` : `Equipo`}</h2>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500 font-medium">Resumen de <span className="font-bold text-blue-600">{data.teamName}</span></p>
                {sessionRole === 'CAPTAIN' && (
                    <button onClick={() => { setTempTeamName(data.teamName); setModalType('EDIT_TEAM'); setIsModalOpen(true); }} className="text-slate-400 hover:text-blue-600 transition-colors">
                        <Edit2 size={14} />
                    </button>
                )}
            </div>
          </div>
          {sessionRole === 'CAPTAIN' && (
            <Button variant="secondary" onClick={() => { if (teamId) { navigator.clipboard.writeText(teamId); alert(`Código copiado: ${teamId}`); } }}>
              <UserPlus size={18} /> Invitar Jugadores
            </Button>
          )}
        </header>

        {/* AI Analysis Section - Improved UI Structure */}
        <div className="bg-gradient-to-r from-blue-950 to-blue-900 rounded-2xl p-0 text-white shadow-xl relative overflow-hidden border border-blue-800">
            <div className="absolute top-0 right-0 w-48 h-48 bg-lime-400 blur-[80px] opacity-10 rounded-full pointer-events-none"></div>
            
            <div className="p-6 border-b border-blue-800/50 flex items-center gap-3">
                 <div className="bg-lime-400/10 p-2 rounded-lg border border-lime-400/20 text-lime-400">
                    <BrainCircuit size={20} />
                 </div>
                 <h3 className="font-bold text-lg text-white">Análisis Técnico IA</h3>
            </div>
            
            {!aiAnalysis ? (
                <div className="p-8 flex flex-col items-center justify-center text-center relative z-10">
                    <Sparkles className="text-lime-400 mb-3 opacity-80" size={32} />
                    <p className="text-blue-200 text-sm mb-6 max-w-md leading-relaxed">
                        Utiliza la Inteligencia Artificial para detectar patrones, rachas y áreas de mejora en tu juego basándose en los datos actuales de la temporada.
                    </p>
                    <Button onClick={handleRunAnalysis} disabled={loadingAi} className="shadow-lg shadow-lime-500/20 px-8 py-3">
                        {loadingAi ? (
                            <>
                                <div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
                                <span>Analizando...</span>
                            </>
                        ) : (
                            'Generar Informe Táctico'
                        )}
                    </Button>
                </div>
            ) : (
                <div className="p-6 grid md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                     {/* Column 1: Summary */}
                     <div className="md:col-span-2 space-y-4">
                         <div>
                            <h4 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-2">Situación Actual</h4>
                            <p className="text-blue-50 text-sm leading-relaxed font-light">
                                {aiAnalysis.summary}
                            </p>
                         </div>
                         <div>
                            <h4 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-2">Detalles Clave</h4>
                            <p className="text-blue-50 text-sm leading-relaxed font-light">
                                 {aiAnalysis.details}
                            </p>
                         </div>
                     </div>

                     {/* Column 2: Technical Focus (Real Objective) */}
                     <div className="bg-blue-900/50 rounded-xl p-4 border border-blue-700/50 flex flex-col justify-center relative overflow-hidden">
                         <div className="absolute -right-4 -top-4 text-blue-800/20 rotate-12">
                             <Sparkles size={100} />
                         </div>
                         <h4 className="text-xs font-black text-lime-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Sparkles size={12} /> Objetivo Prioritario
                         </h4>
                         <p className="text-white font-medium italic text-lg leading-snug relative z-10">
                            "{aiAnalysis.tip}"
                         </p>
                     </div>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 md:col-span-2">
            <h3 className="font-black text-lg mb-6 flex items-center gap-2 text-slate-900"><Trophy className="text-lime-500" size={24} /> Ranking (Top 5)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{fontSize: 12, fontWeight: 600, fill: '#64748b'}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip cursor={{fill: '#eff6ff'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}} />
                  <Bar dataKey="points" radius={[6, 6, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={index === 0 ? '#a3e635' : '#1e3a8a'} /> ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="bg-slate-50 border-none">
            <h3 className="font-black text-lg mb-6 flex items-center gap-2 text-slate-900"><Activity className="text-blue-500" size={24} /> Resumen</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                <span className="text-slate-500 font-medium text-sm uppercase tracking-wide">Jugadores</span>
                <span className="font-black text-2xl text-slate-900">{stats.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                    <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wide">Jornadas Jugadas</span>
                    <div className="flex items-end gap-2 mt-1">
                        <span className="font-black text-xl text-slate-900">{matchDaysPlayedCount} <span className="text-sm text-slate-400 font-normal">/ {matchDaysTotal}</span></span>
                    </div>
                  </div>
                  <div className="flex flex-col p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                    <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wide">WR Jornadas</span>
                    <div className="flex items-end gap-2 mt-1">
                        <span className={`font-black text-xl ${matchDaysWinRate >= 50 ? 'text-lime-600' : 'text-blue-600'}`}>{matchDaysWinRate}%</span>
                    </div>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                    <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wide">Partidos</span>
                    <div className="flex items-end gap-2 mt-1">
                        <span className="font-black text-xl text-slate-900">{totalLineupsPlayed}</span>
                    </div>
                  </div>
                  <div className="flex flex-col p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                    <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wide">WR Partidos</span>
                    <div className="flex items-end gap-2 mt-1">
                        <span className={`font-black text-xl ${matchesWinRate >= 50 ? 'text-lime-600' : 'text-blue-600'}`}>{matchesWinRate}%</span>
                    </div>
                  </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
};

export default DashboardView;
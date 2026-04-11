
import React, { useState, useEffect } from 'react';
import { Edit2, UserPlus, Trophy, BrainCircuit, Activity, Calendar, Sparkles, TrendingUp, TrendingDown, Target, Flame, Clock } from '../Icons';
import { Card, Button, Avatar, ProgressBar, ResultBadge } from '../UIComponents';
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
    isDarkMode: boolean;
}

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
    if (currentSettings.scoringSystem === 'NONE') return calculatedPoints;
    const matches = data.matches.filter(m => m.seasonId === seasonId || (!m.seasonId && seasonId === 'default') || seasonId === 'all');
    const matchesToScore = matches.filter(m => !m.ignorePoints);
    const sortedMatches = [...matchesToScore].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (currentSettings.scoringSystem === 'RANGES' && currentSettings.ranges) {
        sortedMatches.forEach(match => {
            let played = false;
            let result: MatchResult | undefined;
            for (const lineup of match.lineups) {
                if (lineup.player1Id === p.id || lineup.player2Id === p.id) {
                    played = true; result = lineup.result; break;
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

const StatCard = ({ label, value, subtitle, icon, accent = false }: { label: string, value: string | number, subtitle?: string, icon?: React.ReactNode, accent?: boolean }) => (
  <div className={`flex flex-col p-4 rounded-xl border transition-all ${accent ? 'bg-lime-50 dark:bg-lime-900/10 border-lime-200 dark:border-lime-800/50' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'}`}>
    {icon && <div className={`mb-2 ${accent ? 'text-lime-600 dark:text-lime-400' : 'text-slate-400'}`}>{icon}</div>}
    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
    <span className={`font-black text-2xl mt-0.5 ${accent ? 'text-lime-700 dark:text-lime-300' : 'text-slate-900 dark:text-white'}`}>{value}</span>
    {subtitle && <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">{subtitle}</span>}
  </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ 
    data, sessionRole, viewSeasonId, teamId, setTempTeamName, setModalType, setIsModalOpen, isDarkMode 
}) => {
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
    const [loadingAi, setLoadingAi] = useState(false);
    const [visiblePlayerIds, setVisiblePlayerIds] = useState<string[]>([]);
    
    // Initialize visible players
    useEffect(() => {
        if (data && visiblePlayerIds.length === 0) {
            setVisiblePlayerIds(data.players.map(p => p.id));
        }
    }, [data]);
    
    const getFilteredMatches = () => {
        if (!data) return [];
        if (viewSeasonId === 'all') return data.matches;
        return data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));
    };

    const getFilteredStats = () => {
        if (!data) return [];
        const matches = getFilteredMatches();
        return data.players.map(p => {
            let wins = 0, matchesPlayed = 0;
            matches.forEach(m => {
                m.lineups.forEach(l => {
                    if (l.player1Id === p.id || l.player2Id === p.id) {
                        matchesPlayed++;
                        if (l.result === MatchResult.WIN) wins++;
                    }
                });
            });
            return { ...p, matchesPlayed, wins, points: getPointsLocal(p, data, viewSeasonId) };
        });
    };

    const stats = getFilteredStats();
    const filteredMatches = getFilteredMatches();
    
    const getMatchDayResult = (m: MatchDay) => {
        if (!m.lineups || m.lineups.length === 0) return 'PENDING';
        const wins = m.lineups.filter(l => l.result === MatchResult.WIN).length;
        const losses = m.lineups.filter(l => l.result === MatchResult.LOSS).length;
        if (wins > losses) return 'WIN';
        if (losses > wins) return 'LOSS';
        return 'DRAW';
    };

    const playedMatches = filteredMatches.filter(m => m.lineups && m.lineups.length > 0);
    const pendingMatches = filteredMatches.filter(m => !m.lineups || m.lineups.length === 0);
    const matchDaysTotal = filteredMatches.length;
    const matchDaysPlayedCount = playedMatches.length;
    const matchDaysWon = playedMatches.filter(m => getMatchDayResult(m) === 'WIN').length;
    const matchDaysLost = playedMatches.filter(m => getMatchDayResult(m) === 'LOSS').length;
    const matchDaysDraw = playedMatches.filter(m => getMatchDayResult(m) === 'DRAW').length;
    const matchDaysWinRate = matchDaysPlayedCount > 0 ? Math.round((matchDaysWon / matchDaysPlayedCount) * 100) : 0;
    const totalLineupsPlayed = playedMatches.reduce((acc, m) => acc + (m.lineups?.length || 0), 0);
    const totalLineupsWonDirect = playedMatches.reduce((acc, m) => acc + m.lineups.filter(l => l.result === MatchResult.WIN).length, 0);
    const matchesWinRate = totalLineupsPlayed > 0 ? Math.round((totalLineupsWonDirect / totalLineupsPlayed) * 100) : 0;

    // Racha actual
    const getStreak = () => {
        const sorted = [...playedMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (sorted.length === 0) return { type: 'none', count: 0 };
        let count = 0;
        const first = getMatchDayResult(sorted[0]);
        if (first === 'PENDING') return { type: 'none', count: 0 };
        for (const m of sorted) {
            if (getMatchDayResult(m) === first) count++;
            else break;
        }
        return { type: first, count };
    };
    const streak = getStreak();

    // Próximo partido
    const now = new Date();
    const upcomingMatches = pendingMatches
        .filter(m => new Date(m.date) >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const nextMatch = upcomingMatches[0];

    useEffect(() => { setAiAnalysis(null); }, [viewSeasonId, data?.matches.length]);

    const handleRunAnalysis = () => {
        if (!data) return;
        setLoadingAi(true);
        const homeMatches = playedMatches.filter(m => m.isHome);
        const awayMatches = playedMatches.filter(m => !m.isHome);
        const homeWins = homeMatches.filter(m => getMatchDayResult(m) === 'WIN').length;
        const awayWins = awayMatches.filter(m => getMatchDayResult(m) === 'WIN').length;
        const sortedMatchesDesc = [...playedMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const chronologicalStreak = sortedMatchesDesc.slice(0, 5).map(m => getMatchDayResult(m)).reverse();
        const activePlayers = stats.filter(p => p.matchesPlayed > 0);
        const mvpPlayer = activePlayers.length > 0 ? activePlayers.reduce((prev, current) => (prev.points > current.points) ? prev : current) : null;
        const context = {
            teamName: data.teamName, seasonId: viewSeasonId,
            totalScheduledMatches: matchDaysTotal, matchesPlayed: matchDaysPlayedCount,
            matchDaysRecord: { won: matchDaysWon, lost: matchDaysLost, draw: matchDaysDraw },
            individualMatchesRecord: { total: totalLineupsPlayed, won: totalLineupsWonDirect, lost: totalLineupsPlayed - totalLineupsWonDirect },
            performanceSplit: {
                home: `${homeWins} victorias de ${homeMatches.length} jugados`,
                away: `${awayWins} victorias de ${awayMatches.length} jugados`,
            },
            recentStreakChronological: chronologicalStreak.length > 0 ? chronologicalStreak.join(' -> ') : "Sin partidos jugados",
            mvpPlayer: mvpPlayer ? `${mvpPlayer.name} (${mvpPlayer.points} pts)` : 'N/A'
        };
        analyzeTeamStats(context).then(setAiAnalysis).finally(() => setLoadingAi(false));
    };

    if (!data) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in">
             <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-700 border-t-lime-500 rounded-full animate-spin mb-6"></div>
             <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Cargando Equipo</h3>
             <p className="text-slate-400 text-sm mt-2 font-medium">Sincronizando datos en tiempo real...</p>
        </div>
    );

    const chartData = stats
        .filter(p => visiblePlayerIds.includes(p.id))
        .map(p => ({ name: p.name.split(' ')[0], points: p.points, id: p.id }))
        .sort((a, b) => b.points - a.points);
    
    const displayChartData = chartData.slice(0, 10); // Show top 10 of selected
    
    const togglePlayerVisibility = (id: string) => {
        setVisiblePlayerIds(prev => 
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        );
    };

    const selectAllPlayers = () => {
        if (data) setVisiblePlayerIds(data.players.map(p => p.id));
    };

    const deselectAllPlayers = () => {
        setVisiblePlayerIds([]);
    };
    
    // Performance-based sorting for Top Players
    const topPlayers = [...stats]
        .filter(p => p.matchesPlayed > 0)
        .map(p => {
            const winRate = p.wins / p.matchesPlayed;
            // Performance score: 80% Win Rate + 20% Points (normalized by max points)
            const maxPoints = Math.max(...stats.map(s => s.points), 1);
            const normalizedPoints = p.points / maxPoints;
            const performanceScore = (winRate * 80) + (normalizedPoints * 20);
            return { ...p, winRate, performanceScore };
        })
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, 6);
    
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
              {sessionRole === 'CAPTAIN' ? 'Bienvenido de vuelta' : 'Equipo'}
            </p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {sessionRole === 'CAPTAIN' ? data.captainName : data.teamName}
            </h2>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                  Club: <span className="font-bold text-blue-600 dark:text-blue-400">{data.teamName}</span>
                </p>
                {sessionRole === 'CAPTAIN' && (
                    <button onClick={() => { setTempTeamName(data.teamName); setModalType('EDIT_TEAM'); setIsModalOpen(true); }} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        <Edit2 size={14} />
                    </button>
                )}
            </div>
          </div>
          <div className="flex gap-3">
            {sessionRole === 'CAPTAIN' && (
              <Button variant="secondary" onClick={() => { if (teamId) { navigator.clipboard.writeText(teamId); alert(`Código copiado: ${teamId}`); } }}>
                <UserPlus size={18} /> Invitar Jugadores
              </Button>
            )}
          </div>
        </header>

        {/* Próximo partido + racha */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Próximo partido */}
          {nextMatch ? (
            <div className="md:col-span-2 bg-gradient-to-br from-blue-950 to-blue-900 rounded-2xl p-5 text-white border border-blue-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-lime-400 blur-[60px] opacity-10 rounded-full pointer-events-none" />
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-lime-400" />
                <span className="text-xs font-black uppercase tracking-widest text-blue-300">Próxima Jornada</span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-2xl font-black text-white">{nextMatch.opponent.toUpperCase()}</p>
                  <p className="text-blue-300 text-sm mt-1 font-medium">
                    {new Date(nextMatch.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' · '}
                    {new Date(nextMatch.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}h
                  </p>
                </div>
                <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${nextMatch.isHome ? 'bg-blue-400/20 text-blue-200 border border-blue-400/30' : 'bg-orange-400/20 text-orange-200 border border-orange-400/30'}`}>
                  {nextMatch.isHome ? '🏠 Casa' : '✈️ Fuera'}
                </span>
              </div>
              {upcomingMatches.length > 1 && (
                <p className="mt-3 text-xs text-blue-400 font-medium">+{upcomingMatches.length - 1} partidos más pendientes</p>
              )}
            </div>
          ) : (
            <div className="md:col-span-2 bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-5 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-center">
              <div>
                <Calendar size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No hay partidos pendientes</p>
                {sessionRole === 'CAPTAIN' && (
                  <button onClick={() => { setModalType('GENERATE_CALENDAR'); setIsModalOpen(true); }} className="mt-2 text-xs text-blue-500 font-bold hover:underline">
                    Generar calendario →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Racha */}
          <div className={`rounded-2xl p-5 border flex flex-col justify-between ${
            streak.type === 'WIN' ? 'bg-lime-50 dark:bg-lime-900/10 border-lime-200 dark:border-lime-800' :
            streak.type === 'LOSS' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' :
            'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Flame size={14} className={streak.type === 'WIN' ? 'text-lime-500' : streak.type === 'LOSS' ? 'text-red-400' : 'text-slate-400'} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Racha Actual</span>
              </div>
              {streak.type === 'none' ? (
                <p className="text-slate-400 text-sm font-medium mt-2">Sin datos aún</p>
              ) : (
                <>
                  <p className={`text-4xl font-black mt-1 ${streak.type === 'WIN' ? 'text-lime-600 dark:text-lime-400' : streak.type === 'LOSS' ? 'text-red-500 dark:text-red-400' : 'text-blue-500'}`}>
                    {streak.count}
                  </p>
                  <p className={`text-sm font-bold ${streak.type === 'WIN' ? 'text-lime-600 dark:text-lime-400' : streak.type === 'LOSS' ? 'text-red-500 dark:text-red-400' : 'text-blue-500'}`}>
                    {streak.type === 'WIN' ? 'victorias seguidas 🔥' : streak.type === 'LOSS' ? 'derrotas seguidas' : 'empates seguidos'}
                  </p>
                </>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-black text-lime-600 dark:text-lime-400">{matchDaysWon}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">V</p>
              </div>
              <div>
                <p className="text-lg font-black text-slate-400">{matchDaysDraw}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">E</p>
              </div>
              <div>
                <p className="text-lg font-black text-red-500 dark:text-red-400">{matchDaysLost}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">D</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Jugadores" value={stats.length} icon={<Activity size={16} />} />
          <StatCard label="Jornadas" value={`${matchDaysPlayedCount}/${matchDaysTotal}`} subtitle="Jugadas / Totales" />
          <StatCard 
            label="WR Jornadas" 
            value={`${matchDaysWinRate}%`} 
            accent={matchDaysWinRate >= 50}
            subtitle={matchDaysWinRate >= 50 ? 'Por encima del 50%' : 'Hay que mejorar'}
          />
          <StatCard 
            label="WR Partidos" 
            value={`${matchesWinRate}%`} 
            accent={matchesWinRate >= 50}
            subtitle={`${totalLineupsWonDirect}/${totalLineupsPlayed} ganados`}
          />
        </div>

        {/* Gráfico + Top jugadores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Gráfico de barras */}
          <Card className="col-span-1 md:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <h3 className="font-black text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                <Trophy className="text-lime-500" size={22} /> Ranking de Puntos
              </h3>
              <div className="flex items-center gap-2">
                <button 
                    onClick={selectAllPlayers}
                    className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600 transition-colors"
                >
                    Todos
                </button>
                <button 
                    onClick={deselectAllPlayers}
                    className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 transition-colors"
                >
                    Ninguno
                </button>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">
                    {visiblePlayerIds.length} seleccionados
                </span>
              </div>
            </div>

            {/* Player Toggles */}
            <div className="flex flex-wrap gap-2 mb-6 max-h-24 overflow-y-auto p-1 hide-scrollbar">
                {stats.sort((a,b) => a.name.localeCompare(b.name)).map(p => {
                    const isVisible = visiblePlayerIds.includes(p.id);
                    return (
                        <button
                            key={p.id}
                            onClick={() => togglePlayerVisibility(p.id)}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${
                                isVisible 
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' 
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                            }`}
                        >
                            {p.name.split(' ')[0]}
                        </button>
                    );
                })}
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayChartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 700, fill: isDarkMode ? '#94a3b8' : '#64748b'}} axisLine={false} tickLine={false} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: isDarkMode ? '#94a3b8' : '#94a3b8', fontSize: 11}} />
                  <Tooltip 
                    cursor={{fill: isDarkMode ? '#1e293b' : '#f8fafc', radius: 8}} 
                    contentStyle={{
                        borderRadius: '12px', border: 'none', 
                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)', 
                        fontWeight: 'bold',
                        backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                        color: isDarkMode ? '#fff' : '#0f172a',
                        padding: '8px 14px'
                    }} 
                  />
                  <Bar dataKey="points" radius={[6, 6, 0, 0]} barSize={24} label={{ position: 'top', fontSize: 10, fontWeight: 700, fill: isDarkMode ? '#94a3b8' : '#64748b' }}>
                    {displayChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#a3e635' : index === 1 ? '#60a5fa' : (isDarkMode ? '#334155' : '#e2e8f0')} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Top jugadores */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-[40px] rounded-full pointer-events-none" />
            <h3 className="font-black text-lg mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
              <TrendingUp className="text-blue-500" size={22} /> Mejor Rendimiento
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Basado en ratio V/D y puntos</p>
            
            <div className="space-y-4">
              {topPlayers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity size={32} className="text-slate-200 dark:text-slate-700 mb-2" />
                  <p className="text-slate-400 text-sm font-medium">Aún no hay datos de rendimiento</p>
                </div>
              ) : topPlayers.map((p, index) => (
                <div key={p.id} className="group relative">
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="relative">
                      <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                      <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm border border-white dark:border-slate-800 ${
                        index === 0 ? 'bg-lime-400 text-lime-900' : 
                        index === 1 ? 'bg-slate-300 text-slate-700' : 
                        index === 2 ? 'bg-orange-300 text-orange-900' : 
                        'bg-slate-100 dark:bg-slate-700 text-slate-500'
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-end mb-1">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{p.name}</p>
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                          {Math.round(p.winRate * 100)}% WR
                        </span>
                      </div>
                      <ProgressBar 
                        value={p.wins} 
                        max={p.matchesPlayed} 
                        color={index === 0 ? 'lime' : 'blue'} 
                      />
                    </div>
                    
                    <div className="text-right pl-2">
                      <p className="font-black text-slate-900 dark:text-white text-sm leading-none">{p.points}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">PTS</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {topPlayers.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Consistencia</span>
                  <span className="text-lime-500">Alta</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* AI Analysis Section */}
        <div className="bg-gradient-to-r from-blue-950 to-blue-900 rounded-2xl p-0 text-white shadow-xl relative overflow-hidden border border-blue-800">
            <div className="absolute top-0 right-0 w-48 h-48 bg-lime-400 blur-[80px] opacity-10 rounded-full pointer-events-none"></div>
            
            <div className="p-5 border-b border-blue-800/50 flex items-center gap-3">
                 <div className="bg-lime-400/10 p-2 rounded-lg border border-lime-400/20 text-lime-400">
                    <BrainCircuit size={18} />
                 </div>
                 <div>
                   <h3 className="font-bold text-base text-white">Análisis Técnico IA</h3>
                   <p className="text-blue-400 text-xs">Powered by Gemini AI</p>
                 </div>
            </div>
            
            {!aiAnalysis ? (
                <div className="p-8 flex flex-col items-center justify-center text-center relative z-10">
                    <div className="w-16 h-16 bg-lime-400/10 rounded-full flex items-center justify-center mb-4 border border-lime-400/20">
                        <Sparkles className="text-lime-400" size={32} />
                    </div>
                    <h4 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Potencia tu Estrategia</h4>
                    <p className="text-blue-200 text-sm mb-6 max-w-sm leading-relaxed font-medium">
                        Nuestra IA analiza patrones de juego, rachas de victorias y el desempeño de cada jugador para darte una ventaja competitiva.
                    </p>
                    <Button onClick={handleRunAnalysis} disabled={loadingAi} className="shadow-lg shadow-lime-500/20 px-10 py-6 text-base font-black uppercase tracking-widest">
                        {loadingAi ? (
                            <>
                                <div className="w-5 h-5 border-3 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
                                <span>Procesando Datos...</span>
                            </>
                        ) : (
                            <><BrainCircuit size={20} /> Generar Informe Táctico</>
                        )}
                    </Button>
                </div>
            ) : (
                <div className="p-6 grid md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 relative z-10">
                     <div className="md:col-span-2 space-y-6">
                         <div className="relative pl-6 border-l-2 border-lime-400/30">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 bg-lime-400 rounded-full border-4 border-blue-950"></div>
                            <h4 className="text-[10px] font-black text-lime-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Activity size={12} /> Situación Actual
                            </h4>
                            <p className="text-blue-50 text-sm leading-relaxed font-medium">{aiAnalysis.summary}</p>
                         </div>
                         <div className="relative pl-6 border-l-2 border-blue-400/30">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 bg-blue-400 rounded-full border-4 border-blue-950"></div>
                            <h4 className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Target size={12} /> Detalles Clave
                            </h4>
                            <p className="text-blue-50 text-sm leading-relaxed font-medium">{aiAnalysis.details}</p>
                         </div>
                     </div>
                     <div className="bg-blue-900/40 backdrop-blur-sm rounded-2xl p-5 border border-blue-700/50 flex flex-col justify-between relative overflow-hidden group">
                         <div className="absolute -right-6 -top-6 text-lime-400/5 group-hover:text-lime-400/10 transition-colors duration-500">
                             <Sparkles size={140} />
                         </div>
                         <div>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-[10px] font-black text-lime-400 uppercase tracking-widest flex items-center gap-2">
                                    <Trophy size={12} /> Tip de Oro
                                </h4>
                                <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></div>
                            </div>
                            <p className="text-white font-bold italic text-lg leading-tight relative z-10">
                                "{aiAnalysis.tip}"
                            </p>
                         </div>
                         <button onClick={() => setAiAnalysis(null)} className="mt-6 text-[10px] font-black text-blue-400 hover:text-lime-400 transition-colors uppercase tracking-widest flex items-center gap-1">
                           <Clock size={10} /> Actualizar análisis
                         </button>
                     </div>
                </div>
            )}
        </div>
      </div>
    );
};

export default DashboardView;

import React, { useState, useEffect } from 'react';
import { Edit2, UserPlus, Trophy, BrainCircuit, Activity } from '../Icons';
import { Card, Button } from '../UIComponents';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AppState, MatchResult, Player } from '../../types';
import { analyzeMatchStats } from '../../services/geminiService';
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
    // This is a simplified call wrapper. In a real scenario, getPoints logic should be exported from a hook or utility.
    // For now, we will reuse the logic by importing it or copying the utility if needed. 
    // BUT since we can't easily export getPoints from PlayersView if it's not pure, we'll duplicate the pure logic helper in a separate file in future iterations.
    // For this refactor, let's assume getPoints is available or we use a simplified calculation for the chart.
    // *Self-correction*: I will move the getPoints logic to `utils/helpers.ts` or similar if I can, but it depends on 'data'.
    // Let's implement a local version for the chart display to avoid circular deps.
    
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

const DashboardView: React.FC<DashboardViewProps> = ({ 
    data, sessionRole, viewSeasonId, teamId, setTempTeamName, setModalType, setIsModalOpen 
}) => {
    const [aiTip, setAiTip] = useState<string>('');
    
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

    useEffect(() => {
        if (!data) return;
        const totalWins = stats.reduce((acc, p) => acc + p.wins, 0);
        const totalMatches = stats.reduce((acc, p) => acc + p.matchesPlayed, 0);
        analyzeMatchStats(totalWins, totalMatches - totalWins, totalMatches).then(setAiTip);
    }, [data, viewSeasonId]);

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
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-2xl p-6 text-white shadow-xl flex items-start gap-5 relative overflow-hidden border border-blue-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-lime-400 blur-3xl opacity-20 rounded-full pointer-events-none"></div>
            <div className="bg-blue-950/40 p-3 rounded-xl backdrop-blur-sm border border-blue-400/20">
                <BrainCircuit size={24} className="text-lime-400" />
            </div>
            <div className="relative z-10">
                <h3 className="font-bold text-lg mb-1 text-lime-400">Análisis IA</h3>
                <p className="text-blue-100 italic font-light leading-relaxed">"{aiTip || 'Analizando datos...'}"</p>
            </div>
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
              <div className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                <span className="text-slate-500 font-medium text-sm uppercase tracking-wide">Partidos</span>
                <span className="font-black text-2xl text-slate-900">{filteredMatches.length}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                <span className="text-slate-500 font-medium text-sm uppercase tracking-wide">Win Rate</span>
                <span className="font-black text-2xl text-lime-600">{stats.length > 0 ? Math.round((stats.reduce((acc, p) => acc + p.wins, 0) / Math.max(1, stats.reduce((acc, p) => acc + p.matchesPlayed, 0))) * 100) : 0}%</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
};

export default DashboardView;

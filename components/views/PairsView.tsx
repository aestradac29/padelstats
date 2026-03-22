import React, { useState, useMemo } from 'react';
import { Activity, Trophy, Calendar, X, ChevronRight, CheckCircle, XCircle, Table, LayoutGrid, TrendingUp, TrendingDown, Target, Users } from '../Icons';
import { AppState, MatchDay, MatchLineup, MatchResult, Position } from '../../types';
import { Card, Select, Button } from '../UIComponents';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PairsViewProps {
    data: AppState | null;
    viewSeasonId: string;
}

interface PairStats {
    player1Id: string;
    player2Id: string;
    player1Name: string;
    player2Name: string;
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    matches: { matchDay: MatchDay; lineup: MatchLineup }[];
}

const PairsView: React.FC<PairsViewProps> = ({ data, viewSeasonId }) => {
    const [selectedPair, setSelectedPair] = useState<PairStats | null>(null);
    const [sortBy, setSortBy] = useState<'matches' | 'winRate'>('matches');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
    const [activeTab, setActiveTab] = useState<'PAIRS' | 'POSITION' | 'NEMESIS' | 'STREAKS'>('PAIRS');

    const pairStats = useMemo(() => {
        if (!data) return [];

        const filteredMatches = viewSeasonId === 'all' 
            ? data.matches 
            : data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));

        const pairsMap = new Map<string, PairStats>();

        filteredMatches.forEach(matchDay => {
            matchDay.lineups.forEach(lineup => {
                if (!lineup.player1Id || !lineup.player2Id) return;

                // Create a unique key for the pair regardless of order
                const ids = [lineup.player1Id, lineup.player2Id].sort();
                const pairKey = `${ids[0]}_${ids[1]}`;

                if (!pairsMap.has(pairKey)) {
                    const p1 = data.players.find(p => p.id === ids[0]);
                    const p2 = data.players.find(p => p.id === ids[1]);
                    
                    if (!p1 || !p2) return;

                    pairsMap.set(pairKey, {
                        player1Id: p1.id,
                        player2Id: p2.id,
                        player1Name: p1.name,
                        player2Name: p2.name,
                        matchesPlayed: 0,
                        wins: 0,
                        losses: 0,
                        winRate: 0,
                        matches: []
                    });
                }

                const stats = pairsMap.get(pairKey)!;
                stats.matchesPlayed += 1;
                if (lineup.result === MatchResult.WIN) stats.wins += 1;
                if (lineup.result === MatchResult.LOSS) stats.losses += 1;
                stats.matches.push({ matchDay, lineup });
                stats.winRate = Math.round((stats.wins / stats.matchesPlayed) * 100);
            });
        });

        let pairsArray = Array.from(pairsMap.values());
        
        // Filter by player
        if (selectedPlayerId !== 'all') {
            pairsArray = pairsArray.filter(p => p.player1Id === selectedPlayerId || p.player2Id === selectedPlayerId);
        }
        
        // Sort
        pairsArray.sort((a, b) => {
            if (sortBy === 'matches') {
                if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
                return b.winRate - a.winRate;
            } else {
                if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                return b.matchesPlayed - a.matchesPlayed;
            }
        });

        return pairsArray;
    }, [data, viewSeasonId, sortBy, selectedPlayerId]);

    const playerOptions = useMemo(() => {
        if (!data) return [{ value: 'all', label: 'Todos los jugadores' }];
        return [
            { value: 'all', label: 'Todos los jugadores' },
            ...data.players.map(p => ({ value: p.id, label: p.name }))
        ];
    }, [data]);

    const activePlayers = useMemo(() => {
        if (!data) return [];
        // Get all players who have played at least one match in the current filtered set
        const playedIds = new Set<string>();
        pairStats.forEach(p => {
            playedIds.add(p.player1Id);
            playedIds.add(p.player2Id);
        });
        
        return data.players
            .filter(p => playedIds.has(p.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [data, pairStats]);

    const getPairStat = (p1Id: string, p2Id: string) => {
        return pairStats.find(p => 
            (p.player1Id === p1Id && p.player2Id === p2Id) || 
            (p.player1Id === p2Id && p.player2Id === p1Id)
        );
    };

    // --- POSITION SYNERGY ---
    const positionSynergy = useMemo(() => {
        if (selectedPlayerId === 'all' || !data) return null;
        const player = data.players.find(p => p.id === selectedPlayerId);
        if (!player) return null;

        const stats = {
            [Position.DRIVE]: { matches: 0, wins: 0, losses: 0, winRate: 0 },
            [Position.REVES]: { matches: 0, wins: 0, losses: 0, winRate: 0 },
            [Position.AMBOS]: { matches: 0, wins: 0, losses: 0, winRate: 0 },
        };

        const filteredMatches = viewSeasonId === 'all' 
            ? data.matches 
            : data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));

        filteredMatches.forEach(matchDay => {
            matchDay.lineups.forEach(lineup => {
                if (lineup.player1Id === selectedPlayerId || lineup.player2Id === selectedPlayerId) {
                    const partnerId = lineup.player1Id === selectedPlayerId ? lineup.player2Id : lineup.player1Id;
                    const partner = data.players.find(p => p.id === partnerId);
                    if (partner) {
                        stats[partner.position].matches += 1;
                        if (lineup.result === MatchResult.WIN) stats[partner.position].wins += 1;
                        if (lineup.result === MatchResult.LOSS) stats[partner.position].losses += 1;
                    }
                }
            });
        });

        Object.values(stats).forEach(s => {
            s.winRate = s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0;
        });

        return stats;
    }, [data, selectedPlayerId, viewSeasonId]);

    // --- NEMESIS ---
    const nemesisStats = useMemo(() => {
        if (!data) return [];
        const filteredMatches = viewSeasonId === 'all' 
            ? data.matches 
            : data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));

        const rivalsMap = new Map<string, { name: string, matches: number, wins: number, losses: number, winRate: number }>();
        filteredMatches.forEach(matchDay => {
            matchDay.lineups.forEach(lineup => {
                if (!lineup.opponent1Name && !lineup.opponent2Name) return;
                const names = [lineup.opponent1Name || '?', lineup.opponent2Name || '?'].sort();
                const key = `${names[0]} & ${names[1]}`;
                if (!rivalsMap.has(key)) {
                    rivalsMap.set(key, { name: key, matches: 0, wins: 0, losses: 0, winRate: 0 });
                }
                const stat = rivalsMap.get(key)!;
                stat.matches += 1;
                if (lineup.result === MatchResult.WIN) stat.wins += 1;
                if (lineup.result === MatchResult.LOSS) stat.losses += 1;
                stat.winRate = Math.round((stat.wins / stat.matches) * 100);
            });
        });
        return Array.from(rivalsMap.values()).filter(r => r.matches > 0).sort((a, b) => b.losses - a.losses || a.winRate - b.winRate);
    }, [data, viewSeasonId]);

    // --- STREAKS ---
    const streaks = useMemo(() => {
        if (!data) return { hot: [], cold: [] };
        const filteredMatches = viewSeasonId === 'all' 
            ? data.matches 
            : data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));

        const playerMatches = new Map<string, MatchResult[]>();
        const sortedMatches = [...filteredMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        sortedMatches.forEach(matchDay => {
            matchDay.lineups.forEach(lineup => {
                if (lineup.player1Id) {
                    if (!playerMatches.has(lineup.player1Id)) playerMatches.set(lineup.player1Id, []);
                    playerMatches.get(lineup.player1Id)!.push(lineup.result);
                }
                if (lineup.player2Id) {
                    if (!playerMatches.has(lineup.player2Id)) playerMatches.set(lineup.player2Id, []);
                    playerMatches.get(lineup.player2Id)!.push(lineup.result);
                }
            });
        });

        const hot: {player: any, streak: number}[] = [];
        const cold: {player: any, streak: number}[] = [];

        playerMatches.forEach((results, playerId) => {
            if (results.length < 3) return;
            const last3 = results.slice(-3);
            if (last3.every(r => r === MatchResult.WIN)) {
                let count = 0;
                for (let i = results.length - 1; i >= 0; i--) {
                    if (results[i] === MatchResult.WIN) count++;
                    else break;
                }
                const player = data.players.find(p => p.id === playerId);
                if (player) hot.push({ player, streak: count });
            } else if (last3.every(r => r === MatchResult.LOSS)) {
                let count = 0;
                for (let i = results.length - 1; i >= 0; i--) {
                    if (results[i] === MatchResult.LOSS) count++;
                    else break;
                }
                const player = data.players.find(p => p.id === playerId);
                if (player) cold.push({ player, streak: count });
            }
        });

        return { hot: hot.sort((a,b) => b.streak - a.streak), cold: cold.sort((a,b) => b.streak - a.streak) };
    }, [data, viewSeasonId]);

    if (!data) return null;

    if (selectedPair) {
        const chartData = selectedPair.matches.map((m, idx) => {
            let gamesWon = 0;
            let gamesLost = 0;
            [m.lineup.set1, m.lineup.set2, m.lineup.set3].filter(Boolean).forEach(set => {
                const [w, l] = set!.split('-').map(Number);
                if (!isNaN(w) && !isNaN(l)) {
                    gamesWon += w;
                    gamesLost += l;
                }
            });
            return {
                name: `P${idx + 1}`,
                date: new Date(m.matchDay.date).toLocaleDateString(),
                gamesWon,
                gamesLost,
                diff: gamesWon - gamesLost
            };
        });

        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-20">
                <button 
                    onClick={() => setSelectedPair(null)}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-bold text-sm mb-4"
                >
                    <ChevronRight className="rotate-180" size={16} /> Volver a todas las parejas
                </button>

                <div className="bg-gradient-to-br from-blue-900 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500 blur-[100px] opacity-20 rounded-full pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <h2 className="text-sm font-bold text-lime-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Activity size={16} /> Ficha de Pareja
                        </h2>
                        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 mt-6">
                            <div className="text-center md:text-right flex-1">
                                <h3 className="text-3xl font-black">{selectedPair.player1Name}</h3>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-black text-slate-400 shrink-0">
                                &
                            </div>
                            <div className="text-center md:text-left flex-1">
                                <h3 className="text-3xl font-black">{selectedPair.player2Name}</h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-10">
                            <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Partidos</p>
                                <p className="text-3xl font-black">{selectedPair.matchesPlayed}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Victorias</p>
                                <p className="text-3xl font-black text-lime-400">{selectedPair.wins}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Efectividad</p>
                                <p className="text-3xl font-black text-blue-400">{selectedPair.winRate}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {chartData.length > 1 && (
                    <Card className="p-6">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <TrendingUp className="text-blue-500" /> Evolución de Juegos (Diferencia)
                        </h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                    />
                                    <Line type="monotone" dataKey="diff" name="Diferencia de Juegos" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                )}

                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-8 mb-4 flex items-center gap-2">
                    <Calendar className="text-blue-500" /> Historial de Partidos Juntos
                </h3>

                <div className="space-y-4">
                    {selectedPair.matches.map((m, idx) => {
                        const isWin = m.lineup.result === MatchResult.WIN;
                        const isLoss = m.lineup.result === MatchResult.LOSS;
                        const isDraw = m.lineup.result === MatchResult.DRAW;
                        
                        return (
                            <Card key={idx} className="p-0 overflow-hidden border-l-4" style={{ borderLeftColor: isWin ? '#a3e635' : isLoss ? '#ef4444' : '#94a3b8' }}>
                                <div className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${isWin ? 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400' : isLoss ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                {isWin ? 'Victoria' : isLoss ? 'Derrota' : 'Empate'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500">
                                                {new Date(m.matchDay.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="font-bold text-slate-900 dark:text-white">vs {m.matchDay.opponent}</p>
                                        {(m.lineup.opponent1Name || m.lineup.opponent2Name) && (
                                            <p className="text-sm text-slate-500 mt-1">
                                                Rivales: {m.lineup.opponent1Name || '?'} / {m.lineup.opponent2Name || '?'}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        {[m.lineup.set1, m.lineup.set2, m.lineup.set3].filter(Boolean).map((set, i) => (
                                            <div key={i} className="flex-1 sm:flex-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-center min-w-[60px]">
                                                <span className="text-xs text-slate-400 block mb-1 font-bold">S{i+1}</span>
                                                <span className="font-black text-slate-700 dark:text-slate-200">{set}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-20">
            <header className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex-1">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Activity className="text-blue-500" /> Análisis Avanzado
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Sinergia, rivalidades, rachas y más.</p>
                </div>
            </header>

            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
                <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl min-w-max">
                    <button onClick={() => setActiveTab('PAIRS')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'PAIRS' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        <Users size={16} /> Parejas
                    </button>
                    <button onClick={() => setActiveTab('POSITION')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'POSITION' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        <LayoutGrid size={16} /> Posición
                    </button>
                    <button onClick={() => setActiveTab('NEMESIS')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'NEMESIS' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        <Target size={16} /> Némesis
                    </button>
                    <button onClick={() => setActiveTab('STREAKS')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'STREAKS' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        <TrendingUp size={16} /> Rachas
                    </button>
                </div>
            </div>

            {activeTab === 'PAIRS' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                        <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <LayoutGrid size={16} /> Lista
                            </button>
                            <button 
                                onClick={() => setViewMode('matrix')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'matrix' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <Table size={16} /> Matriz
                            </button>
                        </div>

                        {viewMode === 'list' && (
                            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                                <div className="w-full md:w-48">
                                    <Select 
                                        value={selectedPlayerId} 
                                        onChange={(e) => setSelectedPlayerId(e.target.value)}
                                        options={playerOptions}
                                    />
                                </div>
                                <div className="w-full md:w-48">
                                    <Select 
                                        value={sortBy} 
                                        onChange={(e) => setSortBy(e.target.value as 'matches' | 'winRate')}
                                        options={[
                                            { value: 'matches', label: 'Por Partidos' },
                                            { value: 'winRate', label: 'Por % Victorias' }
                                        ]}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {pairStats.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 border-dashed">
                    <Activity size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No hay datos de parejas</h3>
                    <p className="text-slate-500 max-w-md mx-auto">Añade resultados de partidos para empezar a ver las estadísticas de las diferentes parejas que han jugado juntas.</p>
                </div>
            ) : viewMode === 'matrix' ? (
                <Card className="p-0 overflow-hidden border-0 shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-2 sm:p-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]"></th>
                                    {activePlayers.map(p => (
                                        <th key={p.id} className="p-1 sm:p-2 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 align-bottom h-24 sm:h-32 min-w-[48px] sm:min-w-[64px]">
                                            <div className="flex justify-center items-end h-full pb-1">
                                                <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="whitespace-nowrap">
                                                    {p.name}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {activePlayers.map(p1 => (
                                    <tr key={p1.id}>
                                        <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 p-2 sm:p-3 text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 text-left whitespace-nowrap border-r border-b border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                                            {p1.name}
                                        </th>
                                        {activePlayers.map(p2 => {
                                            if (p1.id === p2.id) {
                                                return (
                                                    <td key={p2.id} className="bg-slate-200/50 dark:bg-slate-800/80 border-b border-r border-slate-200 dark:border-slate-700 min-w-[48px] sm:min-w-[64px]">
                                                        <div className="w-full h-full flex items-center justify-center opacity-10">
                                                            <div className="w-8 h-px bg-slate-900 dark:bg-white transform rotate-45"></div>
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            
                                            const stat = getPairStat(p1.id, p2.id);
                                            
                                            if (!stat) {
                                                return <td key={p2.id} className="border-b border-r border-slate-200 dark:border-slate-700 p-1 sm:p-2 text-center text-slate-300 dark:text-slate-600 bg-white dark:bg-slate-800 min-w-[48px] sm:min-w-[64px]">-</td>;
                                            }
                                            
                                            let bgColor = 'bg-slate-50 dark:bg-slate-800';
                                            let textColor = 'text-slate-700 dark:text-slate-300';
                                            
                                            if (stat.winRate >= 60) { 
                                                bgColor = 'bg-lime-100 dark:bg-lime-900/40'; 
                                                textColor = 'text-lime-700 dark:text-lime-400'; 
                                            } else if (stat.winRate <= 40) { 
                                                bgColor = 'bg-red-100 dark:bg-red-900/40'; 
                                                textColor = 'text-red-700 dark:text-red-400'; 
                                            } else { 
                                                bgColor = 'bg-yellow-100 dark:bg-yellow-900/40'; 
                                                textColor = 'text-yellow-700 dark:text-yellow-400'; 
                                            }

                                            return (
                                                <td 
                                                    key={p2.id} 
                                                    className={`border-b border-r border-slate-200 dark:border-slate-700 p-1 sm:p-2 text-center ${bgColor} ${textColor} cursor-pointer hover:opacity-80 transition-opacity min-w-[48px] sm:min-w-[64px]`} 
                                                    onClick={() => setSelectedPair(stat)}
                                                    title={`${stat.player1Name} & ${stat.player2Name}: ${stat.wins}V - ${stat.losses}D`}
                                                >
                                                    <div className="font-black text-xs sm:text-sm">{stat.winRate}%</div>
                                                    <div className="text-[9px] sm:text-[10px] opacity-70 font-bold">{stat.wins}-{stat.losses}</div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pairStats.map((pair) => (
                        <Card 
                            key={`${pair.player1Id}_${pair.player2Id}`} 
                            className="cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-md group"
                            onClick={() => setSelectedPair(pair)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <p className="font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{pair.player1Name}</p>
                                    <p className="font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{pair.player2Name}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                    <ChevronRight size={20} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Partidos</p>
                                    <p className="font-black text-lg text-slate-700 dark:text-slate-300">{pair.matchesPlayed}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Victorias</p>
                                    <p className="font-black text-lg text-lime-600 dark:text-lime-400">{pair.wins}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Efectividad</p>
                                    <p className={`font-black text-lg ${pair.winRate >= 50 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>{pair.winRate}%</p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
            </div>
            )}

            {activeTab === 'POSITION' && (
                <div className="space-y-6 animate-in fade-in">
                    <Card className="p-6">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">Sinergia por Posición</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Selecciona un jugador para ver cómo rinde dependiendo de la posición de su compañero.</p>
                        
                        <div className="w-full md:w-64 mb-8">
                            <Select 
                                value={selectedPlayerId} 
                                onChange={(e) => setSelectedPlayerId(e.target.value)}
                                options={playerOptions}
                            />
                        </div>

                        {selectedPlayerId === 'all' ? (
                            <div className="text-center py-10 text-slate-500">Selecciona un jugador arriba para ver su sinergia.</div>
                        ) : positionSynergy ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {Object.entries(positionSynergy).map(([pos, stats]) => (
                                    <div key={pos} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Jugando con un {pos}</h4>
                                        <div className="flex items-end gap-2 mb-2">
                                            <span className={`text-4xl font-black ${stats.winRate >= 50 ? 'text-lime-500' : stats.matches > 0 ? 'text-red-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                                {stats.winRate}%
                                            </span>
                                            <span className="text-sm font-bold text-slate-400 mb-1">victorias</span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                                            {stats.wins} ganados / {stats.losses} perdidos ({stats.matches} total)
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </Card>
                </div>
            )}

            {activeTab === 'NEMESIS' && (
                <div className="space-y-6 animate-in fade-in">
                    <Card className="p-6">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                            <Target className="text-red-500" /> Rivalidades (Némesis)
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Parejas rivales contra las que más habéis jugado o perdido.</p>
                        
                        {nemesisStats.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">No hay suficientes datos de rivales.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase">Pareja Rival</th>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">Partidos</th>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">Derrotas</th>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">% Victorias vs Ellos</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {nemesisStats.map((stat, i) => (
                                            <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{stat.name}</td>
                                                <td className="p-3 text-center font-medium text-slate-600 dark:text-slate-400">{stat.matches}</td>
                                                <td className="p-3 text-center font-black text-red-500">{stat.losses}</td>
                                                <td className="p-3 text-center font-black text-slate-700 dark:text-slate-300">{stat.winRate}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {activeTab === 'STREAKS' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-6 border-t-4 border-t-lime-500">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                <TrendingUp className="text-lime-500" /> En Racha (Hot)
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Jugadores que han ganado sus últimos 3 o más partidos.</p>
                            
                            {streaks.hot.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">Ningún jugador en racha actualmente.</div>
                            ) : (
                                <div className="space-y-3">
                                    {streaks.hot.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-lime-50 dark:bg-lime-900/20 rounded-xl border border-lime-100 dark:border-lime-900/50">
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{s.player.name}</span>
                                            <span className="flex items-center gap-1 text-xs font-black text-lime-600 dark:text-lime-400 bg-lime-100 dark:bg-lime-900/50 px-2 py-1 rounded-full">
                                                🔥 {s.streak} Victorias
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card className="p-6 border-t-4 border-t-blue-500">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                <TrendingDown className="text-blue-500" /> En Bache (Cold)
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Jugadores que han perdido sus últimos 3 o más partidos.</p>
                            
                            {streaks.cold.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">Ningún jugador en bache actualmente.</div>
                            ) : (
                                <div className="space-y-3">
                                    {streaks.cold.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/50">
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{s.player.name}</span>
                                            <span className="flex items-center gap-1 text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded-full">
                                                🧊 {s.streak} Derrotas
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PairsView;

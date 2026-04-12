import React, { useState, useMemo, useRef } from 'react';
import { Activity, Trophy, Calendar, X, ChevronRight, CheckCircle, XCircle, Table, LayoutGrid, TrendingUp, TrendingDown, Target, Users, ListOrdered, Clock, Download } from '../Icons';
import { AppState, MatchDay, MatchLineup, MatchResult, Position } from '../../types';
import { Card, Select, Button } from '../UIComponents';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';

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
    draws: number;
    winRate: number;
    matches: { matchDay: MatchDay; lineup: MatchLineup }[];
}

const PairsView: React.FC<PairsViewProps> = ({ data, viewSeasonId }) => {
    const [selectedPair, setSelectedPair] = useState<PairStats | null>(null);
    const [sortBy, setSortBy] = useState<'matches' | 'winRate'>('matches');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
    const [activeTab, setActiveTab] = useState<'PAIRS' | 'POSITION' | 'NEMESIS' | 'STREAKS' | 'ORDER'>('PAIRS');
    const [selectedNemesisTeam, setSelectedNemesisTeam] = useState<string>('all');
    const [nemesisSort, setNemesisSort] = useState<{key: 'name' | 'team' | 'matches' | 'wins' | 'losses', direction: 'asc' | 'desc'}>({key: 'losses', direction: 'desc'});
    const [selectedNemesis, setSelectedNemesis] = useState<any | null>(null);
    const [orderViewType, setOrderViewType] = useState<'PLAYERS' | 'PAIRS'>('PLAYERS');
    const [isCopying, setIsCopying] = useState(false);
    
    const matrixRef = useRef<HTMLDivElement>(null);

    const copyMatrixToClipboard = async () => {
        if (!matrixRef.current) return;
        setIsCopying(true);
        
        const originalElement = matrixRef.current;
        
        // Create a clone for capturing to avoid messing with the live UI
        const clone = originalElement.cloneNode(true) as HTMLElement;
        
        // Apply styles to the clone to ensure it's fully visible
        document.body.appendChild(clone);
        clone.style.position = 'fixed';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.width = 'auto';
        clone.style.maxWidth = 'none';
        
        const scrollContainer = clone.querySelector('.overflow-x-auto') as HTMLElement;
        const table = clone.querySelector('table') as HTMLElement;
        const card = clone.querySelector('.shadow-lg') as HTMLElement;
        
        if (scrollContainer && table && card) {
            scrollContainer.style.overflow = 'visible';
            scrollContainer.style.width = 'auto';
            card.style.overflow = 'visible';
            card.style.width = 'auto';
            table.style.width = 'auto';
            table.style.minWidth = '0';
        }

        // Dar tiempo al DOM para que aplique los estilos antes de capturar
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
            const canvas = await html2canvas(clone, {
                backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true,
                width: clone.scrollWidth,
                height: clone.scrollHeight,
                onclone: (clonedDoc) => {
                    // Additional fixes for the cloned document if needed
                    const clonedTable = clonedDoc.querySelector('table');
                    if (clonedTable) {
                        clonedTable.style.borderCollapse = 'collapse';
                    }
                }
            });
            
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({
                                'image/png': blob
                            })
                        ]);
                        alert('¡Matriz completa copiada al portapapeles!');
                    } catch (err) {
                        console.error('Error copying to clipboard', err);
                        alert('No se pudo copiar al portapapeles. Intenta de nuevo.');
                    }
                }
            }, 'image/png');
        } catch (error) {
            console.error('Error generating image', error);
        } finally {
            document.body.removeChild(clone);
            setIsCopying(false);
        }
    };

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
                        draws: 0,
                        winRate: 0,
                        matches: []
                    });
                }

                const stats = pairsMap.get(pairKey)!;
                stats.matchesPlayed += 1;
                if (lineup.result === MatchResult.WIN) stats.wins += 1;
                if (lineup.result === MatchResult.LOSS) stats.losses += 1;
                if (lineup.result === MatchResult.DRAW) stats.draws += 1;
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

        const rivalsMap = new Map<string, { name: string, team: string, matches: number, wins: number, losses: number, winRate: number, playedAgainst: any[] }>();
        
        filteredMatches.forEach(matchDay => {
            const teamName = matchDay.opponent || 'Desconocido';
            
            matchDay.lineups.forEach(lineup => {
                const opponents = [lineup.opponent1Name, lineup.opponent2Name].filter(Boolean) as string[];
                
                opponents.forEach(oppName => {
                    const key = `${oppName}_${teamName}`;
                    if (!rivalsMap.has(key)) {
                        rivalsMap.set(key, { name: oppName, team: teamName, matches: 0, wins: 0, losses: 0, winRate: 0, playedAgainst: [] });
                    }
                    const stat = rivalsMap.get(key)!;
                    stat.matches += 1;
                    if (lineup.result === MatchResult.WIN) stat.wins += 1;
                    if (lineup.result === MatchResult.LOSS) stat.losses += 1;
                    stat.winRate = Math.round((stat.wins / stat.matches) * 100);
                    stat.playedAgainst.push({
                        matchDay,
                        lineup,
                        ourPlayer1: data.players.find(p => p.id === lineup.player1Id),
                        ourPlayer2: data.players.find(p => p.id === lineup.player2Id)
                    });
                });
            });
        });
        
        let statsArray = Array.from(rivalsMap.values());
        if (selectedNemesisTeam !== 'all') {
            statsArray = statsArray.filter(s => s.team === selectedNemesisTeam);
        }
        
        return statsArray.filter(r => r.matches > 0).sort((a, b) => {
            const { key, direction } = nemesisSort;
            let valA = a[key];
            let valB = b[key];
            
            if (direction === 'asc') return valA > valB ? 1 : -1;
            return valA < valB ? 1 : -1;
        });
    }, [data, viewSeasonId, selectedNemesisTeam, nemesisSort]);

    const nemesisTeamOptions = useMemo(() => {
        if (!data) return [{ value: 'all', label: 'Todos los equipos' }];
        const teams = new Set<string>();
        data.matches.forEach(m => {
            if (m.opponent) teams.add(m.opponent);
        });
        return [
            { value: 'all', label: 'Todos los equipos' },
            ...Array.from(teams).sort().map(t => ({ value: t, label: t }))
        ];
    }, [data]);

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

    // --- ORDER ---
    const orderStats = useMemo(() => {
        if (!data) return { players: [], pairs: [], pairPositions: [] };
        const filteredMatches = viewSeasonId === 'all' 
            ? data.matches 
            : data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));

        const playerStats = new Map<string, { name: string, positions: { [key: number]: { matches: number, wins: number } } }>();
        const pairStatsMap = new Map<string, { name: string, player1Id?: string, player2Id?: string, positions: { [key: number]: { matches: number, wins: number } } }>();

        filteredMatches.forEach(matchDay => {
            matchDay.lineups.forEach((lineup, idx) => {
                // Use the explicit pairNumber field if set, otherwise fall back to array index+1
                const pairNum = lineup.pairNumber ?? (idx + 1);
                const p1 = data.players.find(p => p.id === lineup.player1Id);
                const p2 = data.players.find(p => p.id === lineup.player2Id);
                
                if (p1) {
                    if (!playerStats.has(p1.id)) playerStats.set(p1.id, { name: p1.name, positions: {} });
                    const stat = playerStats.get(p1.id)!;
                    if (!stat.positions[pairNum]) stat.positions[pairNum] = { matches: 0, wins: 0 };
                    stat.positions[pairNum].matches += 1;
                    if (lineup.result === MatchResult.WIN) stat.positions[pairNum].wins += 1;
                }
                
                if (p2) {
                    if (!playerStats.has(p2.id)) playerStats.set(p2.id, { name: p2.name, positions: {} });
                    const stat = playerStats.get(p2.id)!;
                    if (!stat.positions[pairNum]) stat.positions[pairNum] = { matches: 0, wins: 0 };
                    stat.positions[pairNum].matches += 1;
                    if (lineup.result === MatchResult.WIN) stat.positions[pairNum].wins += 1;
                }
                
                if (p1 && p2) {
                    const pairId = [p1.id, p2.id].sort().join('_');
                    const pairName = `${p1.name} / ${p2.name}`;
                    if (!pairStatsMap.has(pairId)) pairStatsMap.set(pairId, { name: pairName, player1Id: p1.id, player2Id: p2.id, positions: {} });
                    const stat = pairStatsMap.get(pairId)!;
                    if (!stat.positions[pairNum]) stat.positions[pairNum] = { matches: 0, wins: 0 };
                    stat.positions[pairNum].matches += 1;
                    if (lineup.result === MatchResult.WIN) stat.positions[pairNum].wins += 1;
                }
            });
        });

        const formatStats = (map: Map<any, any>) => {
            return Array.from(map.values()).map(s => {
                let totalMatches = 0;
                let totalWins = 0;
                Object.values(s.positions).forEach((pos: any) => {
                    totalMatches += pos.matches;
                    totalWins += pos.wins;
                });
                return {
                    ...s,
                    totalMatches,
                    totalWins,
                    winRate: totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0
                };
            }).sort((a, b) => b.totalMatches - a.totalMatches);
        };

        // Calculate the maximum pair position used across all matches
        const allPositions = new Set<number>();
        filteredMatches.forEach(matchDay => {
            matchDay.lineups.forEach((lineup, idx) => {
                const pairNum = lineup.pairNumber ?? (idx + 1);
                allPositions.add(pairNum);
            });
        });
        const maxPairPos = allPositions.size > 0 ? Math.max(...Array.from(allPositions)) : (data?.settings?.gender === 'FEMENINO' ? 4 : 5);
        // Use a contiguous range 1..max so columns are consistent across all rows
        const pairPositions = Array.from({ length: maxPairPos }, (_, i) => i + 1);

        return {
            players: formatStats(playerStats),
            pairs: formatStats(pairStatsMap),
            pairPositions
        };
    }, [data, viewSeasonId]);

    if (!data) return null;

    if (selectedPair) {
        let cumulativeDiff = 0;
        const chartData = selectedPair.matches.map((m, idx) => {
            let gamesWon = 0;
            let gamesLost = 0;
            [m.lineup.set1, m.lineup.set2, m.lineup.set3].filter(Boolean).forEach(set => {
                const [left, right] = set!.split('-').map(Number);
                if (!isNaN(left) && !isNaN(right)) {
                    // In this app, scores are always stored as [OurScore]-[TheirScore]
                    gamesWon += left;
                    gamesLost += right;
                }
            });
            const matchDiff = gamesWon - gamesLost;
            cumulativeDiff += matchDiff;
            return {
                name: `P${idx + 1}`,
                date: new Date(m.matchDay.date).toLocaleDateString(),
                gamesWon,
                gamesLost,
                matchDiff,
                cumulativeDiff
            };
        });

        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-24">
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

                        <div className="grid grid-cols-4 gap-4 mt-10">
                            <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Partidos</p>
                                <p className="text-3xl font-black">{selectedPair.matchesPlayed}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Victorias</p>
                                <p className="text-3xl font-black text-lime-400">{selectedPair.wins}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Derrotas</p>
                                <p className="text-3xl font-black text-red-400">{selectedPair.losses}</p>
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
                        <div className="mb-6">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <TrendingUp className="text-blue-500" /> Evolución de Juegos (Diferencia Acumulada)
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Muestra si la pareja va ganando o perdiendo más juegos a lo largo del tiempo. Una línea ascendente significa que ganan más juegos de los que pierden en total.
                            </p>
                        </div>
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
                                        formatter={(value: number) => [value > 0 ? `+${value}` : value, 'Diferencia Acumulada']}
                                    />
                                    <Line type="monotone" dataKey="cumulativeDiff" name="Diferencia Acumulada" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
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
                                            {m.lineup.pairNumber && (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                    P{m.lineup.pairNumber}
                                                </span>
                                            )}
                                            <span className="text-xs font-bold text-slate-500">
                                                {new Date(m.matchDay.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
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

    if (selectedNemesis) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-24">
                <button 
                    onClick={() => setSelectedNemesis(null)}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-bold text-sm mb-4"
                >
                    <ChevronRight className="rotate-180" size={16} /> Volver a Némesis
                </button>

                <div className="bg-gradient-to-br from-red-900 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-500 blur-[100px] opacity-20 rounded-full pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <h2 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Target size={16} /> Ficha de Rival
                        </h2>
                        <div className="mt-6">
                            <h3 className="text-3xl font-black mb-1">{selectedNemesis.name}</h3>
                            <p className="text-slate-400 font-bold uppercase tracking-widest">{selectedNemesis.team}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-10">
                            <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Partidos</p>
                                <p className="text-3xl font-black">{selectedNemesis.matches}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Nuestras Victorias</p>
                                <p className="text-3xl font-black text-lime-400">{selectedNemesis.wins}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Nuestras Derrotas</p>
                                <p className="text-3xl font-black text-red-400">{selectedNemesis.losses}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-8 mb-4 flex items-center gap-2">
                    <Calendar className="text-blue-500" /> Historial de Partidos
                </h3>

                <div className="space-y-4">
                    {selectedNemesis.playedAgainst.map((m: any, idx: number) => {
                        const isWin = m.lineup.result === MatchResult.WIN;
                        const isLoss = m.lineup.result === MatchResult.LOSS;
                        
                        return (
                            <Card key={idx} className="p-0 overflow-hidden border-l-4" style={{ borderLeftColor: isWin ? '#a3e635' : isLoss ? '#ef4444' : '#94a3b8' }}>
                                <div className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${isWin ? 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400' : isLoss ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                {isWin ? 'Victoria' : isLoss ? 'Derrota' : 'Empate'}
                                            </span>
                                            <span className="text-slate-400 font-bold text-[10px] uppercase flex items-center gap-1">
                                                <Clock size={10} /> {new Date(m.matchDay.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="font-bold text-slate-900 dark:text-white">vs {m.ourPlayer1?.name} & {m.ourPlayer2?.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Jornada vs {m.matchDay.opponent}</p>
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
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in pb-24">
            <header className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Estadísticas</p>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Activity className="text-blue-500" size={28}/> Análisis Avanzado
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Sinergia, rivalidades, rachas y más.</p>
                </div>
            </header>

            <div className="flex overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
                <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl min-w-max gap-0.5">
                    {[
                        { id: 'PAIRS',    label: 'Parejas',   icon: Users },
                        { id: 'POSITION', label: 'Posición',  icon: LayoutGrid },
                        { id: 'NEMESIS',  label: 'Némesis',   icon: Target },
                        { id: 'STREAKS',  label: 'Rachas',    icon: TrendingUp },
                        { id: 'ORDER',    label: 'Orden',     icon: ListOrdered },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <tab.icon size={15}/> {tab.label}
                        </button>
                    ))}
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
                        {viewMode === 'matrix' && (
                            <Button 
                                variant="secondary" 
                                className="flex items-center gap-2 py-2 px-4 text-sm"
                                onClick={copyMatrixToClipboard}
                                disabled={isCopying}
                            >
                                <Download size={16} />
                                {isCopying ? 'Copiando...' : 'Copiar Matriz'}
                            </Button>
                        )}
                    </div>

                    {pairStats.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Activity size={28} className="text-slate-300 dark:text-slate-500" />
                    </div>
                    <h3 className="text-base font-black text-slate-700 dark:text-slate-300 mb-1">No hay datos de parejas</h3>
                    <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs mx-auto">Añade resultados de partidos para ver las estadísticas de parejas.</p>
                </div>
            ) : viewMode === 'matrix' ? (
                <div ref={matrixRef}>
                    <Card className="p-0 overflow-hidden border-0 shadow-lg">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-2 sm:p-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]"></th>
                                    {activePlayers.map(p => (
                                        <th key={p.id} className="p-1 sm:p-2 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 align-bottom h-24 sm:h-32 min-w-[48px] sm:min-w-[64px] relative overflow-hidden">
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 whitespace-nowrap">
                                                {p.name}
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
                </div>
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
                            
                            <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">PJ</p>
                                    <p className="font-black text-lg text-slate-700 dark:text-slate-300">{pair.matchesPlayed}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">V</p>
                                    <p className="font-black text-lg text-lime-600 dark:text-lime-400">{pair.wins}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">D</p>
                                    <p className="font-black text-lg text-red-500 dark:text-red-400">{pair.losses}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">%</p>
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
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                    <Target className="text-red-500" /> Rivalidades (Némesis)
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Jugadores rivales individuales contra los que más habéis jugado o perdido.</p>
                            </div>
                            <div className="w-full md:w-64 shrink-0">
                                <Select 
                                    value={selectedNemesisTeam} 
                                    onChange={(e) => setSelectedNemesisTeam(e.target.value)}
                                    options={nemesisTeamOptions}
                                />
                            </div>
                        </div>
                        
                        {nemesisStats.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">No hay suficientes datos de rivales para el filtro seleccionado.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:text-blue-500" onClick={() => setNemesisSort({key: 'name', direction: nemesisSort.key === 'name' && nemesisSort.direction === 'asc' ? 'desc' : 'asc'})}>Jugador Rival</th>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:text-blue-500" onClick={() => setNemesisSort({key: 'team', direction: nemesisSort.key === 'team' && nemesisSort.direction === 'asc' ? 'desc' : 'asc'})}>Equipo</th>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center cursor-pointer hover:text-blue-500" onClick={() => setNemesisSort({key: 'matches', direction: nemesisSort.key === 'matches' && nemesisSort.direction === 'asc' ? 'desc' : 'asc'})}>Partidos</th>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center cursor-pointer hover:text-blue-500" onClick={() => setNemesisSort({key: 'wins', direction: nemesisSort.key === 'wins' && nemesisSort.direction === 'asc' ? 'desc' : 'asc'})}>Victorias</th>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center cursor-pointer hover:text-blue-500" onClick={() => setNemesisSort({key: 'losses', direction: nemesisSort.key === 'losses' && nemesisSort.direction === 'asc' ? 'desc' : 'asc'})}>Derrotas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {nemesisStats.map((stat, i) => (
                                            <tr key={i} onClick={() => setSelectedNemesis(stat)} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                                                <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{stat.name}</td>
                                                <td className="p-3 text-sm text-slate-500 dark:text-slate-400">{stat.team}</td>
                                                <td className="p-3 text-center font-medium text-slate-600 dark:text-slate-400">{stat.matches}</td>
                                                <td className="p-3 text-center font-black text-lime-600 dark:text-lime-400">{stat.wins}</td>
                                                <td className="p-3 text-center font-black text-red-500">{stat.losses}</td>
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

            {activeTab === 'ORDER' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl inline-flex shadow-inner">
                            <button onClick={() => setOrderViewType('PLAYERS')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${orderViewType === 'PLAYERS' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Jugadores</button>
                            <button onClick={() => setOrderViewType('PAIRS')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${orderViewType === 'PAIRS' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Parejas</button>
                        </div>
                        
                        {orderViewType === 'PAIRS' && (
                            <div className="w-full md:w-64">
                                <Select 
                                    value={selectedPlayerId} 
                                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                                    options={playerOptions}
                                />
                            </div>
                        )}
                    </div>

                    <Card className="p-0 overflow-hidden">
                        <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Muestra el rendimiento según la posición de pareja asignada en cada jornada (Pareja 1 = primera pareja, etc.). El número de pareja se establece al registrar los resultados.
                            </p>
                        </div>
                        {(orderViewType === 'PLAYERS' ? orderStats.players : orderStats.pairs).length === 0 ? (
                            <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
                                No hay datos de orden de parejas registrados aún.
                            </div>
                        ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase sticky left-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-w-[120px]">{orderViewType === 'PLAYERS' ? 'Jugador' : 'Pareja'}</th>
                                        {orderStats.pairPositions.map(pos => (
                                            <th key={pos} className="p-3 text-xs font-bold text-slate-500 uppercase text-center whitespace-nowrap">Pareja {pos}</th>
                                        ))}
                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(orderViewType === 'PLAYERS' ? orderStats.players : orderStats.pairs.filter(p => selectedPlayerId === 'all' || p.player1Id === selectedPlayerId || p.player2Id === selectedPlayerId)).map((stat, i) => (
                                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-3 font-bold text-slate-800 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 min-w-[120px]">{stat.name}</td>
                                            {orderStats.pairPositions.map(pos => {
                                                const posStat = stat.positions[pos];
                                                if (!posStat) return <td key={pos} className="p-3 text-center text-slate-300 dark:text-slate-600">-</td>;
                                                const winRate = Math.round((posStat.wins / posStat.matches) * 100);
                                                return (
                                                    <td key={pos} className="p-3 text-center min-w-[90px]">
                                                        <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">{posStat.wins}V - {posStat.matches - posStat.wins}D</div>
                                                        <div className={`text-[10px] font-black ${winRate >= 50 ? 'text-lime-500' : 'text-red-500'}`}>{winRate}%</div>
                                                    </td>
                                                );
                                            })}
                                            <td className="p-3 text-center min-w-[90px]">
                                                <div className="font-black text-slate-900 dark:text-white text-sm">{stat.totalWins}V - {stat.totalMatches - stat.totalWins}D</div>
                                                <div className={`text-[10px] font-black ${stat.winRate >= 50 ? 'text-lime-500' : 'text-red-500'}`}>{stat.winRate}%</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
};

export default PairsView;

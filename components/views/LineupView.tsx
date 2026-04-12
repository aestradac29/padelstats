

import React, { useState, useEffect } from 'react';
import { LayoutGrid, Check, BrainCircuit, Sparkles, ArrowUpDown, Trash2, X, ChevronDown, ChevronUp, User, Zap, Shield, Trophy, Copy } from '../Icons';
import { Button, Card, Checkbox, Select } from '../UIComponents';
import { AppState, Position } from '../../types';
import { getLineupSuggestion } from '../../services/geminiService';
import { getPoints } from './PlayersView';

interface LineupViewProps {
    data: AppState | null;
    viewSeasonId: string;
}

const LineupView: React.FC<LineupViewProps> = ({ data, viewSeasonId }) => {
    const [opponentDesc, setOpponentDesc] = useState('');
    const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);
    const [autoSort, setAutoSort] = useState(true);
    const [lineupAdvice, setLineupAdvice] = useState<string>('');
    const [isThinking, setIsThinking] = useState(false);
    
    // UI State for Mobile Collapsibles
    const [showAvailability, setShowAvailability] = useState(true);
    const [showAI, setShowAI] = useState(false);

    // State for the Draft Board (5 pairs)
    const [draftLineup, setDraftLineup] = useState<{player1Id: string, player2Id: string}[]>(
        Array(5).fill({ player1Id: '', player2Id: '' })
    );

    // Initialize available players with all players on mount
    useEffect(() => {
        if (data?.players) {
            setAvailablePlayers(data.players.map(p => p.id));
        }
    }, [data]);

    const getFilteredMatches = () => {
        if (!data) return [];
        if (viewSeasonId === 'all') return data.matches;
        return data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));
    };

    const togglePlayerAvailability = (id: string) => {
        setAvailablePlayers(prev => {
            if (prev.includes(id)) return prev.filter(pid => pid !== id);
            return [...prev, id];
        });
    };

    const sortPairs = (pairs: {player1Id: string, player2Id: string}[]) => {
        const matches = getFilteredMatches();
        return [...pairs].sort((a, b) => {
            const p1A = data?.players.find(p => p.id === a.player1Id);
            const p2A = data?.players.find(p => p.id === a.player2Id);
            const pointsA = (p1A ? getPoints(p1A, matches, viewSeasonId, data!) : 0) + 
                            (p2A ? getPoints(p2A, matches, viewSeasonId, data!) : 0);

            const p1B = data?.players.find(p => p.id === b.player1Id);
            const p2B = data?.players.find(p => p.id === b.player2Id);
            const pointsB = (p1B ? getPoints(p1B, matches, viewSeasonId, data!) : 0) + 
                            (p2B ? getPoints(p2B, matches, viewSeasonId, data!) : 0);
            
            // Push empty slots to the bottom
            if ((!a.player1Id && !a.player2Id) && (b.player1Id || b.player2Id)) return 1;
            if ((a.player1Id || a.player2Id) && (!b.player1Id && !b.player2Id)) return -1;

            return pointsB - pointsA;
        });
    };

    const handleAIAutoFill = async () => {
        if (!data || !opponentDesc) return;
        setIsThinking(true);
        setLineupAdvice('');
        
        try {
            // Pass available players to AI
            const result = await getLineupSuggestion(data.players, availablePlayers, opponentDesc);
            
            // 1. Update Reasoning
            setLineupAdvice(result.reasoning);

            // 2. Update Board
            if (result.lineup && Array.isArray(result.lineup)) {
                let newDraft = [...draftLineup];
                result.lineup.forEach((pair, index) => {
                    if (index < 5) {
                        newDraft[index] = { 
                            player1Id: pair.player1Id || '', 
                            player2Id: pair.player2Id || '' 
                        };
                    }
                });
                // Always sort AI results for better UX
                newDraft = sortPairs(newDraft);
                setDraftLineup(newDraft);
                // Collapse sidebar on mobile to show results
                if (window.innerWidth < 1024) {
                    setShowAvailability(false);
                    setShowAI(false);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsThinking(false);
        }
    };

    const handleSortByPoints = () => {
        setDraftLineup(sortPairs(draftLineup));
    };

    const handleCopyLineup = () => {
        let text = `🎾 *Alineación ${data?.teamName || 'Equipo'}*\n`;
        if (opponentDesc) text += `🆚 Rival: ${opponentDesc}\n`;
        text += `\n`;

        let hasContent = false;
        draftLineup.slice(0, data?.settings?.gender === 'FEMENINO' ? 4 : 5).forEach((pair, index) => {
            const p1 = data?.players.find(p => p.id === pair.player1Id);
            const p2 = data?.players.find(p => p.id === pair.player2Id);

            if (p1 || p2) {
                hasContent = true;
                const name1 = p1 ? p1.name : '___';
                const name2 = p2 ? p2.name : '___';
                const points1 = p1 && data ? getPoints(p1, data.matches, viewSeasonId, data) : 0;
                const points2 = p2 && data ? getPoints(p2, data.matches, viewSeasonId, data) : 0;
                const totalPoints = points1 + points2;
                // Swapped order: Revés (Left) / Drive (Right) to match visual layout
                text += `${index + 1}️⃣ ${name2} / ${name1} (${totalPoints} pts)\n`;
            }
        });

        if (!hasContent) {
            alert("La alineación está vacía.");
            return;
        }
        
        text += `\n💪 ¡Vamos Equipo!`;

        navigator.clipboard.writeText(text).then(() => {
            alert("✅ Alineación copiada al portapapeles");
        }).catch(err => {
            console.error('Error al copiar: ', err);
            alert("Error al copiar al portapapeles");
        });
    };

    const updatePair = (index: number, field: 'player1Id' | 'player2Id', value: string) => {
        let newDraft = [...draftLineup];
        newDraft[index] = { ...newDraft[index], [field]: value };
        if (autoSort) {
            newDraft = sortPairs(newDraft);
        }
        setDraftLineup(newDraft);
    };

    const clearPair = (index: number) => {
        let newDraft = [...draftLineup];
        newDraft[index] = { player1Id: '', player2Id: '' };
        // No need to sort if empty, but good to keep consistency
        setDraftLineup(newDraft);
    };

    // Filter options based on availability
    const matchesForPoints = getFilteredMatches();
    const playersForSelect = data?.players.filter(p => availablePlayers.includes(p.id)) || [];
    
    // Sort dropdown options by points for easier selection
    const sortedPlayersForSelect = [...playersForSelect].sort((a, b) => {
        const pa = getPoints(a, matchesForPoints, viewSeasonId, data!);
        const pb = getPoints(b, matchesForPoints, viewSeasonId, data!);
        return pb - pa;
    });

    const playerOptions = [{label: 'Seleccionar...', value: ''}, ...sortedPlayersForSelect.map(p => {
        const side = p.position === Position.DRIVE ? 'D' : p.position === Position.REVES ? 'R' : 'A';
        const points = getPoints(p, matchesForPoints, viewSeasonId, data!);
        return {
            label: `${p.name} (${side}) - ${points} pts`,
            value: p.id
        };
    })];

    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in pb-24">
           <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Estrategia</p>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <LayoutGrid className="text-lime-500" size={28}/> Pizarra Táctica
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Diseña las parejas y estrategia para la jornada.</p>
              </div>
              <div className="flex gap-2 items-center">
                   <Checkbox label="Auto-ordenar" checked={autoSort} onChange={setAutoSort} />
              </div>
          </header>
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
               
               {/* LEFT COLUMN */}
               <div className="xl:col-span-4 space-y-4">

                   {/* Convocatoria */}
                   <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                      <div
                        className="flex justify-between items-center px-5 py-4 cursor-pointer bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700/60"
                        onClick={() => setShowAvailability(!showAvailability)}
                      >
                          <h3 className="font-bold text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <Check size={15} className="text-lime-500"/> Convocados
                          </h3>
                          <div className="flex items-center gap-2">
                             <span className={`text-xs font-black px-2 py-0.5 rounded-full ${availablePlayers.length > 0 ? 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                               {availablePlayers.length} / {data?.players.length || 0}
                             </span>
                             {showAvailability ? <ChevronUp size={15} className="text-slate-400"/> : <ChevronDown size={15} className="text-slate-400"/>}
                          </div>
                      </div>
                      {showAvailability && (
                        <div className="p-4">
                            <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                                {['Drive', 'Revés', 'Ambos'].map(pos => {
                                    const posPlayers = data?.players.filter(p => p.position === pos) || [];
                                    if (posPlayers.length === 0) return null;
                                    
                                    // Sort by points descending
                                    posPlayers.sort((a, b) => {
                                        const pa = getPoints(a, matchesForPoints, viewSeasonId, data!);
                                        const pb = getPoints(b, matchesForPoints, viewSeasonId, data!);
                                        return pb - pa;
                                    });

                                    return (
                                        <div key={pos}>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                {pos} <span className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></span>
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {posPlayers.map(p => {
                                                    const isAvailable = availablePlayers.includes(p.id);
                                                    const points = getPoints(p, matchesForPoints, viewSeasonId, data!);
                                                    
                                                    // Compute last 3 form for this player
                                                    const playerFormMatches = [...matchesForPoints]
                                                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                                        .filter(m => m.lineups && m.lineups.some(l => l.player1Id === p.id || l.player2Id === p.id));
                                                    const last3 = playerFormMatches.slice(-3).map(m => {
                                                        const l = m.lineups.find(l => l.player1Id === p.id || l.player2Id === p.id);
                                                        return l?.result;
                                                    }).filter(Boolean);

                                                    return (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => togglePlayerAvailability(p.id)}
                                                            className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold border-2 transition-all duration-200 ${
                                                              isAvailable
                                                                ? 'bg-lime-400 text-blue-950 border-lime-400 shadow-sm shadow-lime-400/20'
                                                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-1.5 truncate">
                                                                <span className="truncate">{p.name.split(' ')[0]}</span>
                                                                <span className={`text-[10px] opacity-60`}>({points})</span>
                                                            </div>
                                                            {last3.length > 0 && (
                                                                <div className="flex gap-0.5 ml-1 flex-shrink-0">
                                                                    {last3.map((r, i) => (
                                                                        <span key={i} className={`w-2 h-2 rounded-full ${r === 'Victoria' ? 'bg-lime-700' : r === 'Derrota' ? 'bg-red-700' : 'bg-blue-700'}`} title={r === 'Victoria' ? 'V' : r === 'Derrota' ? 'D' : 'E'}/>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex justify-between">
                                <button onClick={() => setAvailablePlayers(data?.players.map(p => p.id) || [])} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline px-1">Seleccionar Todos</button>
                                <button onClick={() => setAvailablePlayers([])} className="text-[10px] font-bold text-slate-400 hover:text-red-500 px-1">Limpiar Selección</button>
                            </div>
                        </div>
                      )}
                   </div>

                   {/* IA Táctica */}
                   <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-slate-900 text-white rounded-2xl shadow-xl relative overflow-hidden border border-blue-900/50">
                       <div className="absolute top-0 right-0 w-28 h-28 bg-lime-400 blur-[60px] opacity-15 rounded-full pointer-events-none"/>
                       <div className="flex justify-between items-center px-5 py-4 cursor-pointer relative z-20 border-b border-blue-900/40" onClick={() => setShowAI(!showAI)}>
                           <h3 className="font-bold text-sm uppercase tracking-widest flex items-center gap-2 text-white">
                             <BrainCircuit size={16} className="text-lime-400"/> Asistente IA
                           </h3>
                           {showAI ? <ChevronUp size={16} className="text-slate-500"/> : <ChevronDown size={16} className="text-slate-500"/>}
                       </div>
                       {showAI && (
                       <div className="p-5 pt-4 space-y-4 relative z-10">
                           <div>
                               <label className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-2 block">Descripción del Rival</label>
                               <textarea
                                  className="w-full p-3 rounded-xl border border-blue-800/50 bg-blue-950/50 text-sm text-blue-100 focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/50 outline-none min-h-[80px] placeholder:text-slate-600 resize-none transition-all"
                                  placeholder="Ej. Pista rápida, rivales agresivos al fondo..."
                                  value={opponentDesc}
                                  onChange={(e) => setOpponentDesc(e.target.value)}
                               />
                           </div>
                           <Button
                              className="w-full justify-center font-black"
                              onClick={handleAIAutoFill}
                              disabled={!opponentDesc || isThinking || availablePlayers.length < 2}
                           >
                               {isThinking
                                 ? <><div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin"/> Calculando...</>
                                 : <><Sparkles size={14}/> Calcular Alineación Óptima</>
                               }
                           </Button>
                           {availablePlayers.length < 2 && (
                             <p className="text-[10px] text-amber-400 text-center font-medium">Marca al menos 2 jugadores como disponibles</p>
                           )}
                       </div>
                       )}
                   </div>

                   {/* AI Reasoning */}
                   {lineupAdvice && (
                       <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 p-5 animate-in slide-in-from-bottom-4">
                           <h4 className="font-bold text-xs uppercase text-blue-700 dark:text-blue-300 mb-2.5 flex items-center gap-2">
                             <Shield size={13}/> Informe Técnico IA
                           </h4>
                           <p className="text-xs text-blue-900/80 dark:text-blue-200/80 leading-relaxed whitespace-pre-wrap">{lineupAdvice}</p>
                       </div>
                   )}
               </div>

               {/* RIGHT COLUMN: The Board */}
               <div className="xl:col-span-8 space-y-3">
                   {/* Pista */}
                   <div className="bg-slate-900 rounded-3xl p-5 md:p-7 shadow-2xl relative overflow-hidden border border-slate-800">
                        {/* Court markings */}
                        <div className="absolute inset-6 border border-slate-800/60 rounded-xl pointer-events-none"/>
                        <div className="absolute top-1/2 left-6 right-6 h-px bg-slate-800/60 pointer-events-none"/>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-slate-800/40 rounded-full pointer-events-none"/>

                        {/* Board header */}
                        <div className="flex justify-between items-center mb-5 relative z-10">
                               <div className="flex items-center gap-2">
                                 <Trophy size={16} className="text-amber-400"/>
                                 <h3 className="text-white font-black text-sm uppercase tracking-widest">Pista Central</h3>
                                 <span className="text-[10px] text-slate-500 font-medium">
                                   {draftLineup.filter(p => p.player1Id || p.player2Id).length} parejas
                                 </span>
                               </div>
                               <div className="flex gap-1.5">
                                    <button onClick={handleCopyLineup} title="Copiar al portapapeles"
                                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-lime-400 transition-colors px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 uppercase tracking-wide">
                                        <Copy size={12}/> Copiar
                                    </button>
                                    <button onClick={() => setDraftLineup(Array(5).fill({ player1Id: '', player2Id: '' }))} title="Limpiar todo"
                                      className="p-1.5 text-slate-600 hover:text-red-400 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors">
                                        <Trash2 size={14}/>
                                    </button>
                               </div>
                        </div>

                        <div className="space-y-3 relative z-10">
                           {draftLineup.slice(0, data?.settings?.gender === 'FEMENINO' ? 4 : 5).map((pair, idx) => {
                               const p1 = data?.players.find(p => p.id === pair.player1Id);
                               const p2 = data?.players.find(p => p.id === pair.player2Id);
                               const points1 = p1 ? getPoints(p1, matchesForPoints, viewSeasonId, data!) : 0;
                               const points2 = p2 ? getPoints(p2, matchesForPoints, viewSeasonId, data!) : 0;
                               const totalPairPoints = points1 + points2;
                               const isFilled = pair.player1Id || pair.player2Id;

                               return (
                                   <div key={idx} className={`group transition-all duration-200 ${!isFilled ? 'opacity-50 hover:opacity-75' : 'opacity-100'}`}>
                                       <div className={`bg-slate-800/60 border rounded-2xl p-3 flex flex-col md:flex-row items-center gap-3 transition-all duration-200 ${isFilled ? 'border-slate-600 hover:border-slate-500' : 'border-slate-700/50 border-dashed'}`}>

                                           {/* Pair number */}
                                           <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900/60 border border-slate-700/50 flex-shrink-0">
                                               <span className={`text-lg font-black transition-colors ${isFilled ? 'text-lime-400' : 'text-slate-600 group-hover:text-slate-500'}`}>{idx + 1}</span>
                                           </div>

                                           {/* Mobile pair label */}
                                           <div className="md:hidden w-full flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pareja {idx + 1}</span>
                                                {totalPairPoints > 0 && (
                                                  <span className="text-[10px] bg-slate-900 text-lime-400 px-2 py-0.5 rounded-full font-mono border border-slate-700">{totalPairPoints} pts</span>
                                                )}
                                                <button onClick={() => clearPair(idx)} className="text-slate-600 hover:text-red-400"><X size={13}/></button>
                                           </div>

                                           {/* Player 2 - Revés (left) */}
                                           <div className="flex-1 w-full">
                                                <div className="relative bg-slate-700/40 rounded-xl border border-orange-500/20 overflow-hidden">
                                                    <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-3 pt-1.5 pb-0 pointer-events-none">
                                                        <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0"/>
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Revés</span>
                                                    </div>
                                                    <Select
                                                        options={playerOptions}
                                                        value={pair.player2Id}
                                                        onChange={(e) => updatePair(idx, 'player2Id', e.target.value)}
                                                        className="w-full bg-transparent border-none text-white text-sm font-bold pt-5 pb-2 px-3 h-auto focus:ring-0 cursor-pointer"
                                                    />
                                                </div>
                                           </div>

                                           {/* Center: total pts */}
                                           <div className="hidden md:flex flex-col items-center gap-0.5 w-14 flex-shrink-0">
                                               {totalPairPoints > 0 ? (
                                                   <>
                                                       <span className="text-[9px] text-slate-500 font-bold uppercase">pts</span>
                                                       <span className="text-base font-black text-lime-400 leading-none">{totalPairPoints}</span>
                                                   </>
                                               ) : (
                                                   <span className="text-slate-700 text-xl">·</span>
                                               )}
                                           </div>

                                           {/* Player 1 - Drive (right) */}
                                           <div className="flex-1 w-full">
                                                <div className="relative bg-slate-700/40 rounded-xl border border-blue-500/20 overflow-hidden">
                                                    <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-3 pt-1.5 pb-0 pointer-events-none">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"/>
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Drive</span>
                                                    </div>
                                                    <Select
                                                        options={playerOptions}
                                                        value={pair.player1Id}
                                                        onChange={(e) => updatePair(idx, 'player1Id', e.target.value)}
                                                        className="w-full bg-transparent border-none text-white text-sm font-bold pt-5 pb-2 px-3 h-auto focus:ring-0 cursor-pointer"
                                                    />
                                                </div>
                                           </div>

                                           {/* Desktop clear */}
                                           <button onClick={() => clearPair(idx)} className="hidden md:block p-1.5 text-slate-600 hover:text-red-400 flex-shrink-0 transition-colors">
                                               <X size={15}/>
                                           </button>
                                       </div>
                                   </div>
                               );
                           })}
                        </div>
                   </div>

                   {/* Legend */}
                   <div className="flex gap-6 justify-center text-[10px] uppercase font-bold text-slate-400 tracking-wider py-1">
                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500"/><span>Revés (izq)</span></span>
                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"/><span>Drive (der)</span></span>
                        <span className="flex items-center gap-1.5"><Zap size={10} className="text-lime-500"/><span>Puntos totales</span></span>
                   </div>
               </div>
          </div>
      </div>
    );
};

export default LineupView;
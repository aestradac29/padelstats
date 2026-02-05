
import React, { useState, useEffect } from 'react';
import { LayoutGrid, Check, BrainCircuit, Sparkles, ArrowUpDown, Trash2, X, ChevronDown, ChevronUp, User, Zap, Shield, Trophy } from '../Icons';
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
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-20">
           <header className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2"><LayoutGrid className="text-lime-500" /> Pizarra Táctica</h2>
                <p className="text-slate-500 mt-1">Diseña la estrategia y las parejas para la jornada.</p>
              </div>
              <div className="flex gap-2">
                   <Checkbox label="Ordenar por Ranking" checked={autoSort} onChange={setAutoSort} />
              </div>
          </header>
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
               
               {/* LEFT COLUMN: Controls & Availability */}
               <div className="xl:col-span-4 space-y-6">
                   
                   {/* 1. Convocatoria (Availability) */}
                   <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="flex justify-between items-center p-4 cursor-pointer bg-slate-50 border-b border-slate-100" onClick={() => setShowAvailability(!showAvailability)}>
                          <h3 className="font-bold text-sm uppercase tracking-wide text-slate-700 flex items-center gap-2"><Check size={16} className="text-lime-600"/> Disponibles</h3>
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-bold bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md">{availablePlayers.length}</span>
                             {showAvailability ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                          </div>
                      </div>
                      {showAvailability && (
                        <div className="p-4 bg-slate-50/50">
                            {/* ADDED: p-2 padding to container to prevent clipping of scaled items */}
                            <div className="flex flex-wrap gap-2 max-h-[250px] overflow-y-auto p-2">
                                {data?.players.map(p => {
                                    const isAvailable = availablePlayers.includes(p.id);
                                    const points = getPoints(p, matchesForPoints, viewSeasonId, data!);
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => togglePlayerAvailability(p.id)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isAvailable ? 'bg-lime-400 text-blue-900 border-lime-500 shadow-md transform scale-105' : 'bg-white border-slate-200 text-slate-400 opacity-60 hover:opacity-100'}`}
                                        >
                                            {p.name} <span className="opacity-50 text-[10px]">({points})</span>
                                        </button>
                                    )
                                })}
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between">
                                <button onClick={() => setAvailablePlayers(data?.players.map(p => p.id) || [])} className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded">Marcar Todos</button>
                                <button onClick={() => setAvailablePlayers([])} className="text-[10px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded">Desmarcar</button>
                            </div>
                        </div>
                      )}
                   </div>

                   {/* 2. Tactical Assistant */}
                   <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500 blur-[50px] opacity-20 rounded-full pointer-events-none"></div>
                       <div className="flex justify-between items-center p-5 cursor-pointer relative z-20 border-b border-slate-700/50" onClick={() => setShowAI(!showAI)}>
                           <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2"><BrainCircuit size={18} className="text-lime-400"/> IA Táctica</h3>
                           {showAI ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                       </div>
                       
                       {(showAI || window.innerWidth >= 1280) && (
                       <div className="p-5 pt-4 space-y-4 relative z-10">
                           <div>
                               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Análisis del Rival</label>
                               <textarea 
                                  className="w-full p-3 rounded-xl border border-slate-600 bg-slate-900/50 text-sm text-blue-100 focus:ring-1 focus:ring-lime-400 focus:border-lime-400 outline-none min-h-[80px] placeholder:text-slate-600 resize-none transition-all" 
                                  placeholder="Ej. Pista rápida, rivales jóvenes..." 
                                  value={opponentDesc} 
                                  onChange={(e) => setOpponentDesc(e.target.value)}
                               ></textarea>
                           </div>
                           <Button 
                              className="w-full justify-center h-10 text-xs font-black bg-lime-400 hover:bg-lime-300 text-blue-900 shadow-lg shadow-lime-900/20" 
                              onClick={handleAIAutoFill} 
                              disabled={!opponentDesc || isThinking || availablePlayers.length < 2}
                           >
                               {isThinking ? 'Generando Estrategia...' : <><Sparkles size={14} /> Calcular Alineación Óptima</>}
                           </Button>
                       </div>
                       )}
                   </div>

                   {/* AI Reasoning Display */}
                   {lineupAdvice && (
                       <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5 animate-in slide-in-from-top-4">
                           <h4 className="font-bold text-xs uppercase text-blue-700 mb-2 flex items-center gap-2"><Shield size={14}/> Informe Técnico</h4>
                           <p className="text-xs text-blue-900/80 leading-relaxed whitespace-pre-wrap font-medium">{lineupAdvice}</p>
                       </div>
                   )}
               </div>

               {/* RIGHT COLUMN: The Board */}
               <div className="xl:col-span-8">
                   {/* CHANGED: Reduced min-h from 600px to 500px and added flex-col justify-center to vertically center content */}
                   <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden md:min-h-[500px] border border-slate-800 flex flex-col justify-center">
                        {/* Background Decor */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] border-2 border-slate-800/50 rounded-xl pointer-events-none"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-slate-800/50 pointer-events-none"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] border border-slate-800/50 rounded-full pointer-events-none"></div>

                        <div className="space-y-4 relative z-10 w-full">
                           <div className="flex justify-between items-center mb-4 px-2">
                               <h3 className="text-white font-black text-lg uppercase tracking-widest flex items-center gap-2">
                                   <Trophy size={18} className="text-yellow-500"/> Pista Central
                               </h3>
                               <div className="flex gap-2">
                                    <button onClick={handleSortByPoints} className="text-slate-400 hover:text-white transition-colors p-2 bg-slate-800 rounded-lg" title="Reordenar por fuerza">
                                        <ArrowUpDown size={16}/>
                                    </button>
                                    <button onClick={() => setDraftLineup(Array(5).fill({ player1Id: '', player2Id: '' }))} className="text-slate-400 hover:text-red-400 transition-colors p-2 bg-slate-800 rounded-lg" title="Limpiar todo">
                                        <Trash2 size={16}/>
                                    </button>
                               </div>
                           </div>

                           {draftLineup.map((pair, idx) => {
                               // Calculate Combined Points for the Pair
                               const p1 = data?.players.find(p => p.id === pair.player1Id);
                               const p2 = data?.players.find(p => p.id === pair.player2Id);
                               const points1 = p1 ? getPoints(p1, matchesForPoints, viewSeasonId, data!) : 0;
                               const points2 = p2 ? getPoints(p2, matchesForPoints, viewSeasonId, data!) : 0;
                               const totalPairPoints = points1 + points2;
                               const isEmpty = !pair.player1Id && !pair.player2Id;

                               return (
                                   <div key={idx} className={`relative group transition-all duration-300 ${isEmpty ? 'opacity-70' : 'opacity-100'}`}>
                                       {/* Card Container - CHANGED: Increased padding (md:p-3) to give more presence */}
                                       <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 hover:border-slate-500 rounded-xl p-2 md:p-3 flex flex-col md:flex-row items-center gap-2 md:gap-4 shadow-lg">
                                           
                                           {/* Position Number */}
                                           <div className="hidden md:flex flex-col items-center justify-center w-12 h-full border-r border-slate-700/50 pr-2">
                                               <span className="text-2xl font-black text-slate-600 group-hover:text-lime-500 transition-colors">{idx + 1}</span>
                                           </div>
                                            
                                           {/* Mobile Header */}
                                           <div className="md:hidden w-full flex justify-between items-center px-2 pt-1">
                                                <span className="text-xs font-black text-slate-500 uppercase">Pareja {idx + 1}</span>
                                                <button onClick={() => clearPair(idx)} className="text-slate-500"><X size={14}/></button>
                                           </div>

                                           {/* Player 1 (Drive) */}
                                           <div className="flex-1 w-full relative">
                                                <div className="absolute top-2 left-3 z-10 pointer-events-none">
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-900/50">Drive</span>
                                                </div>
                                                <div className="bg-slate-700/50 rounded-lg p-1">
                                                    {/* CHANGED: Increased input height to h-11 */}
                                                    <Select 
                                                        options={playerOptions} 
                                                        value={pair.player1Id} 
                                                        onChange={(e) => updatePair(idx, 'player1Id', e.target.value)}
                                                        className="w-full bg-transparent border-none text-white text-sm font-bold pl-14 h-11 focus:ring-0 cursor-pointer"
                                                    />
                                                </div>
                                           </div>

                                           {/* VS / Connector */}
                                           <div className="hidden md:flex flex-col items-center justify-center px-2">
                                               {totalPairPoints > 0 ? (
                                                   <div className="flex flex-col items-center">
                                                       <span className="text-[10px] text-slate-400 font-bold">PTS</span>
                                                       <span className="text-sm font-black text-lime-400">{totalPairPoints}</span>
                                                   </div>
                                               ) : (
                                                   <span className="text-slate-600 font-bold text-xs">·</span>
                                               )}
                                           </div>

                                           {/* Player 2 (Revés) */}
                                           <div className="flex-1 w-full relative">
                                                <div className="absolute top-2 left-3 z-10 pointer-events-none">
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-orange-400 bg-orange-950/80 px-1.5 py-0.5 rounded border border-orange-900/50">Revés</span>
                                                </div>
                                                <div className="bg-slate-700/50 rounded-lg p-1">
                                                    {/* CHANGED: Increased input height to h-11 */}
                                                    <Select 
                                                        options={playerOptions} 
                                                        value={pair.player2Id} 
                                                        onChange={(e) => updatePair(idx, 'player2Id', e.target.value)}
                                                        className="w-full bg-transparent border-none text-white text-sm font-bold pl-16 h-11 focus:ring-0 cursor-pointer"
                                                    />
                                                </div>
                                           </div>

                                           {/* Desktop Actions */}
                                           <div className="hidden md:flex items-center pl-2 border-l border-slate-700/50">
                                                <button onClick={() => clearPair(idx)} className="p-2 text-slate-600 hover:text-red-400 transition-colors">
                                                    <X size={16} />
                                                </button>
                                           </div>
                                            
                                           {/* Mobile Points Badge */}
                                           {totalPairPoints > 0 && (
                                               <div className="md:hidden w-full flex justify-center pb-1">
                                                   <span className="text-[10px] bg-slate-900 text-lime-400 px-2 py-0.5 rounded-full font-mono border border-slate-700">{totalPairPoints} pts</span>
                                               </div>
                                           )}
                                       </div>
                                   </div>
                               );
                           })}
                        </div>
                   </div>
                   
                   {/* Legend */}
                   <div className="mt-4 flex gap-4 justify-center text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Drive</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Revés</span>
                        <span className="flex items-center gap-1"><Zap size={10} className="text-lime-500"/> Puntos Totales</span>
                   </div>
               </div>
          </div>
      </div>
    );
};

export default LineupView;

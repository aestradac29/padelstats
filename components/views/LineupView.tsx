import React, { useState, useEffect } from 'react';
import { LayoutGrid, Check, BrainCircuit, Sparkles, ArrowUpDown, Trash2, X, ChevronDown, ChevronUp } from '../Icons';
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
    const [focus, setFocus] = useState<'aggressive' | 'defensive' | 'balanced'>('balanced');
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
            const result = await getLineupSuggestion(data.players, availablePlayers, opponentDesc, focus);
            
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
    const playersForSelect = data?.players.filter(p => availablePlayers.includes(p.id)) || [];
    const playerOptions = [{label: 'Seleccionar...', value: ''}, ...playersForSelect.map(p => {
        // Add extra info to the label: Name (Side) [Points]
        const side = p.position === Position.DRIVE ? 'D' : p.position === Position.REVES ? 'R' : 'A';
        const points = getPoints(p, getFilteredMatches(), viewSeasonId, data!);
        return {
            label: `${p.name} ${p.surname || ''} (${side}) [${points}pts]`,
            value: p.id
        };
    })];

    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in pb-20">
           <header className="text-center mb-8">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2"><LayoutGrid className="text-lime-500" /> Pizarra de Alineación</h2>
              <p className="text-slate-500 mt-2 text-lg">Gestiona la convocatoria y diseña tus parejas.</p>
          </header>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
               
               {/* LEFT COLUMN: Controls & Availability */}
               <div className="lg:col-span-4 space-y-4 md:space-y-6">
                   
                   {/* 1. Convocatoria (Availability) - Collapsible on Mobile */}
                   <Card className="border border-slate-200 shadow-md p-0 overflow-hidden">
                      <div className="flex justify-between items-center p-4 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors" onClick={() => setShowAvailability(!showAvailability)}>
                          <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2"><Check className="text-lime-500"/> Convocatoria</h3>
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-bold bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded-full">{availablePlayers.length} / {data?.players.length}</span>
                             {showAvailability ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                          </div>
                      </div>
                      {showAvailability && (
                        <div className="p-4 border-t border-slate-100">
                            <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-2">
                                {data?.players.map(p => {
                                    const isAvailable = availablePlayers.includes(p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => togglePlayerAvailability(p.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${isAvailable ? 'bg-lime-50 border-lime-400 text-slate-900 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white'}`}
                                        >
                                            <div className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-lime-500' : 'bg-slate-300'}`}></div>
                                            {p.name}
                                        </button>
                                    )
                                })}
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                                <button onClick={() => setAvailablePlayers(data?.players.map(p => p.id) || [])} className="text-[10px] font-bold text-blue-600 hover:underline">Marcar Todos</button>
                                <button onClick={() => setAvailablePlayers([])} className="text-[10px] font-bold text-slate-400 hover:text-red-500 hover:underline">Desmarcar Todos</button>
                            </div>
                        </div>
                      )}
                   </Card>

                   {/* 2. Tactical Assistant - Collapsible on Mobile */}
                   <Card className="bg-slate-900 text-white border-none shadow-xl relative overflow-hidden p-0">
                       <div className="absolute top-0 right-0 w-40 h-40 bg-lime-500 blur-3xl opacity-20 rounded-full pointer-events-none"></div>
                       <div className="flex justify-between items-center p-4 cursor-pointer relative z-20" onClick={() => setShowAI(!showAI)}>
                           <h3 className="font-bold text-lg flex items-center gap-2"><BrainCircuit className="text-lime-400"/> Asistente Táctico</h3>
                           {showAI ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                       </div>
                       
                       {(showAI || window.innerWidth >= 1024) && ( // Always show on desktop if logical, or just toggle. Let's rely on state but default closed on mobile.
                       <div className="p-4 pt-0 space-y-4 relative z-10 border-t border-slate-800/50 mt-2">
                           <div>
                               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Contexto del Rival</label>
                               <textarea 
                                  className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white focus:ring-2 focus:ring-lime-400 outline-none min-h-[100px] placeholder:text-slate-500" 
                                  placeholder="Ej. Rival fuerte en casa, pista rápida..." 
                                  value={opponentDesc} 
                                  onChange={(e) => setOpponentDesc(e.target.value)}
                               ></textarea>
                           </div>
                           <div>
                               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Estrategia</label>
                               <div className="grid grid-cols-3 gap-2">
                                   {['aggressive', 'balanced', 'defensive'].map(f => ( 
                                       <button 
                                          key={f} 
                                          onClick={() => setFocus(f as any)} 
                                          className={`py-2 px-1 rounded-lg text-[10px] font-bold uppercase transition-all border ${focus === f ? 'bg-lime-500 border-lime-500 text-slate-900' : 'bg-transparent border-slate-700 text-slate-400 hover:border-lime-500/50'}`}
                                       >
                                           {f === 'aggressive' ? 'Ofensiva' : f === 'balanced' ? 'Equilibrada' : 'Defensiva'}
                                       </button> 
                                   ))}
                               </div>
                           </div>
                           <Button 
                              className="w-full justify-center h-12 text-sm font-black shadow-lime-500/20 shadow-lg mt-2" 
                              onClick={handleAIAutoFill} 
                              disabled={!opponentDesc || isThinking || availablePlayers.length < 2}
                           >
                               {isThinking ? ( 
                                   <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin"></div> Pensando...</span> 
                               ) : ( 
                                   <><Sparkles size={16} /> Generar Alineación IA</> 
                               )}
                           </Button>
                       </div>
                       )}
                   </Card>

                   {/* AI Reasoning Display */}
                   {lineupAdvice && (
                       <div className="bg-white rounded-2xl shadow-lg border border-lime-200 p-5 animate-in slide-in-from-left-4">
                           <h4 className="font-bold text-xs uppercase text-lime-600 mb-2 flex items-center gap-2"><BrainCircuit size={14}/> Análisis de la IA</h4>
                           <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{lineupAdvice}</p>
                       </div>
                   )}
               </div>

               {/* RIGHT COLUMN: Interactive Board */}
               <div className="lg:col-span-8 space-y-4">
                   <div className="flex justify-end mb-2">
                      <Checkbox label="Auto-ordenar por Ranking" checked={autoSort} onChange={setAutoSort} />
                   </div>
                   {draftLineup.map((pair, idx) => (
                       <div key={idx} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-start gap-4 transition-all hover:shadow-md hover:border-blue-200 group">
                           
                           <div className="flex items-center justify-between w-full border-b border-slate-100 pb-3 mb-1">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center font-black text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-colors text-sm">
                                      {idx + 1}
                                  </div>
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pareja {idx + 1}</span>
                               </div>
                               <button 
                                  onClick={() => clearPair(idx)}
                                  className="md:hidden p-2 text-slate-300 hover:text-red-500 bg-slate-50 rounded-lg"
                                  title="Limpiar Pareja"
                               >
                                  <X size={18} />
                               </button>
                           </div>

                           {/* Players Selection Row - Stacked on Mobile, Row on Desktop */}
                           <div className="flex flex-col md:flex-row gap-4 w-full">
                               <div className="relative flex-1">
                                   <span className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] font-bold text-blue-600 uppercase tracking-wider z-10">Jugador 1</span>
                                   <Select 
                                      options={playerOptions} 
                                      value={pair.player1Id} 
                                      onChange={(e) => updatePair(idx, 'player1Id', e.target.value)}
                                      className="w-full border-slate-300 focus:border-blue-500 h-12 text-sm"
                                   />
                               </div>
                               <div className="relative flex-1">
                                   <span className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] font-bold text-orange-500 uppercase tracking-wider z-10">Jugador 2</span>
                                   <Select 
                                      options={playerOptions} 
                                      value={pair.player2Id} 
                                      onChange={(e) => updatePair(idx, 'player2Id', e.target.value)}
                                      className="w-full border-slate-300 focus:border-blue-500 h-12 text-sm"
                                   />
                               </div>
                               <button 
                                  onClick={() => clearPair(idx)}
                                  className="hidden md:block p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors self-end md:self-auto border border-transparent hover:border-red-100"
                                  title="Limpiar Pareja"
                              >
                                  <X size={20} />
                              </button>
                           </div>
                       </div>
                   ))}
                   
                   <div className="flex flex-col md:flex-row justify-end pt-4 gap-2">
                       <button
                          className="w-full md:w-auto text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 transition-colors bg-white px-4 py-3 rounded-lg border border-slate-200 hover:border-blue-200 shadow-sm"
                          onClick={handleSortByPoints}
                       >
                           <ArrowUpDown size={14} /> Ordenar manualmente
                       </button>
                       <button 
                          className="w-full md:w-auto text-xs font-bold text-slate-400 hover:text-red-500 flex items-center justify-center gap-1 transition-colors bg-white px-4 py-3 rounded-lg border border-slate-200 hover:border-red-200 shadow-sm"
                          onClick={() => setDraftLineup(Array(5).fill({ player1Id: '', player2Id: '' }))}
                       >
                           <Trash2 size={14} /> Limpiar Pizarra Completa
                       </button>
                   </div>
               </div>
          </div>
      </div>
    );
};

export default LineupView;
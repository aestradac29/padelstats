
import React, { useState } from 'react';
import { LayoutGrid, Check, BrainCircuit, Sparkles, ArrowUpDown, Trash2, X, ChevronDown, ChevronUp, User, Zap, Shield, Trophy, Copy, List, Edit2 } from '../Icons';
import { Button, Card, Checkbox, Select } from '../UIComponents';
import { Player, Position } from '../../types';
import { getLineupSuggestion } from '../../services/geminiService';

const QuickLineupView: React.FC = () => {
    const [bulkText, setBulkText] = useState('');
    const [players, setPlayers] = useState<Player[]>([]);
    const [opponentDesc, setOpponentDesc] = useState('');
    const [lineupAdvice, setLineupAdvice] = useState<string>('');
    const [isThinking, setIsThinking] = useState(false);
    const [autoSort, setAutoSort] = useState(true);
    
    // UI State
    const [showParser, setShowParser] = useState(true);
    const [draftLineup, setDraftLineup] = useState<{player1Id: string, player2Id: string}[]>(
        Array(5).fill({ player1Id: '', player2Id: '' })
    );

    const handleParseText = () => {
        const lines = bulkText.split(/\r?\n/);
        const parsedPlayers: Player[] = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let tempLine = trimmed;
            let position = Position.AMBOS;
            let handedness: 'right' | 'left' = 'right';
            let initialPoints = 0;

            // 1. Extract Points
            const pointsMatch = tempLine.match(/\b\d+(\.\d+)?\b/); 
            if (pointsMatch) {
                 const val = Number(pointsMatch[0]);
                 if (!isNaN(val)) {
                     initialPoints = val;
                     tempLine = tempLine.replace(pointsMatch[0], '');
                 }
            }

            // 2. Extract Position
            if (/\b(drive|derecha)\b/i.test(tempLine)) {
                position = Position.DRIVE;
                tempLine = tempLine.replace(/\b(drive|derecha)\b/i, '');
            } else if (/\b(reves|revés|back|backhand)\b/i.test(tempLine)) {
                 position = Position.REVES;
                 tempLine = tempLine.replace(/\b(reves|revés|back|backhand)\b/i, '');
            }

            // 3. Extract Handedness
            if (/\b(zurdo|zurda|left|izq)\b/i.test(tempLine)) {
                handedness = 'left';
                tempLine = tempLine.replace(/\b(zurdo|zurda|left|izq)\b/i, '');
            }

            // 4. Cleanup Name
            let name = tempLine.replace(/[,;\t-]/g, ' ').replace(/\s+/g, ' ').trim();
            name = name.replace(/\b(puntos|pts|ptos)\b/i, '').trim();

            if (name) {
                parsedPlayers.push({
                    id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    name,
                    position,
                    handedness,
                    initialPoints,
                    level: 3.0,
                    matchesPlayed: 0,
                    wins: 0
                });
            }
        }
        setPlayers(parsedPlayers);
        if (parsedPlayers.length > 0) setShowParser(false);
    };

    const sortPairs = (pairs: {player1Id: string, player2Id: string}[]) => {
        return [...pairs].sort((a, b) => {
            const p1A = players.find(p => p.id === a.player1Id);
            const p2A = players.find(p => p.id === a.player2Id);
            const pointsA = (p1A?.initialPoints || 0) + (p2A?.initialPoints || 0);

            const p1B = players.find(p => p.id === b.player1Id);
            const p2B = players.find(p => p.id === b.player2Id);
            const pointsB = (p1B?.initialPoints || 0) + (p2B?.initialPoints || 0);
            
            if ((!a.player1Id && !a.player2Id) && (b.player1Id || b.player2Id)) return 1;
            if ((a.player1Id || a.player2Id) && (!b.player1Id && !b.player2Id)) return -1;

            return pointsB - pointsA;
        });
    };

    const handleAIAutoFill = async () => {
        if (players.length < 2 || !opponentDesc) return;
        setIsThinking(true);
        setLineupAdvice('');
        
        try {
            const result = await getLineupSuggestion(players, players.map(p => p.id), opponentDesc);
            setLineupAdvice(result.reasoning);

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
                if (autoSort) newDraft = sortPairs(newDraft);
                setDraftLineup(newDraft);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsThinking(false);
        }
    };

    const handleCopyLineup = () => {
        let text = `🎾 *Alineación Rápida*\n`;
        if (opponentDesc) text += `🆚 Rival: ${opponentDesc}\n`;
        text += `\n`;

        let hasContent = false;
        draftLineup.forEach((pair, index) => {
            const p1 = players.find(p => p.id === pair.player1Id);
            const p2 = players.find(p => p.id === pair.player2Id);

            if (p1 || p2) {
                hasContent = true;
                const name1 = p1 ? p1.name : '___';
                const name2 = p2 ? p2.name : '___';
                text += `${index + 1}️⃣ ${name2} / ${name1}\n`;
            }
        });

        if (!hasContent) return;
        text += `\n💪 ¡Vamos Equipo!`;

        navigator.clipboard.writeText(text).then(() => {
            alert("✅ Alineación copiada");
        });
    };

    const updatePair = (index: number, field: 'player1Id' | 'player2Id', value: string) => {
        let newDraft = [...draftLineup];
        newDraft[index] = { ...newDraft[index], [field]: value };
        if (autoSort) newDraft = sortPairs(newDraft);
        setDraftLineup(newDraft);
    };

    const playerOptions = [{label: 'Seleccionar...', value: ''}, ...[...players].sort((a,b) => b.initialPoints - a.initialPoints).map(p => ({
        label: `${p.name} (${p.position === Position.DRIVE ? 'D' : p.position === Position.REVES ? 'R' : 'A'}) - ${p.initialPoints} pts`,
        value: p.id
    }))];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-20">
            <header className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2"><Sparkles className="text-lime-500" /> Alineación Rápida</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Pega tu lista de jugadores y genera una alineación al instante.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setShowParser(!showParser)}>
                        {showParser ? 'Ver Pizarra' : 'Editar Jugadores'}
                    </Button>
                </div>
            </header>

            {showParser ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="p-6 space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2"><List size={20} className="text-blue-500"/> Pegar Jugadores</h3>
                        <p className="text-xs text-slate-500">Formato sugerido: "Nombre Apellido, Posición, Puntos". Ej: "Juan Perez Drive 1500"</p>
                        <textarea 
                            className="w-full h-64 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-sm outline-none focus:ring-2 focus:ring-lime-400 transition-all"
                            placeholder="Pega aquí tu lista de jugadores..."
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                        />
                        <Button className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white" onClick={handleParseText} disabled={!bulkText.trim()}>
                            Procesar Lista ({bulkText.split('\n').filter(l => l.trim()).length} líneas)
                        </Button>
                    </Card>

                    <Card className="p-6 space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2"><Check size={20} className="text-lime-500"/> Jugadores Detectados</h3>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {players.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 italic">No se han detectado jugadores todavía.</div>
                            ) : (
                                players.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                                                {p.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{p.name}</p>
                                                <p className="text-[10px] text-slate-500 uppercase font-black">{p.position} · {p.handedness === 'left' ? 'Zurdo' : 'Diestro'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-lime-600">{p.initialPoints} pts</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {players.length > 0 && (
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500">{players.length} jugadores listos</span>
                                <Button variant="ghost" className="text-red-500" onClick={() => setPlayers([])}>Limpiar Todo</Button>
                            </div>
                        )}
                    </Card>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    <div className="xl:col-span-4 space-y-6">
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-xl p-5 space-y-4">
                            <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2"><BrainCircuit size={18} className="text-lime-400"/> IA Táctica</h3>
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
                               className="w-full justify-center bg-lime-400 hover:bg-lime-300 text-blue-900" 
                               onClick={handleAIAutoFill} 
                               disabled={!opponentDesc || isThinking || players.length < 2}
                            >
                                {isThinking ? 'Generando...' : 'Calcular Alineación'}
                            </Button>
                        </div>

                        {lineupAdvice && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/50 p-5">
                                <h4 className="font-bold text-xs uppercase text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2"><Shield size={14}/> Informe Técnico</h4>
                                <p className="text-xs text-blue-900/80 dark:text-blue-200/80 leading-relaxed whitespace-pre-wrap font-medium">{lineupAdvice}</p>
                            </div>
                        )}
                    </div>

                    <div className="xl:col-span-8">
                        <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl relative border border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-white font-black text-lg uppercase tracking-widest flex items-center gap-2"><Trophy size={18} className="text-yellow-500"/> Pizarra</h3>
                                <div className="flex gap-2">
                                    <button onClick={handleCopyLineup} className="text-slate-400 hover:text-lime-400 p-2 bg-slate-800 rounded-lg"><Copy size={16}/></button>
                                    <button onClick={() => setDraftLineup(Array(5).fill({ player1Id: '', player2Id: '' }))} className="text-slate-400 hover:text-red-400 p-2 bg-slate-800 rounded-lg"><Trash2 size={16}/></button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {draftLineup.map((pair, idx) => {
                                    const p1 = players.find(p => p.id === pair.player1Id);
                                    const p2 = players.find(p => p.id === pair.player2Id);
                                    const totalPoints = (p1?.initialPoints || 0) + (p2?.initialPoints || 0);

                                    return (
                                        <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex flex-col md:flex-row items-center gap-4">
                                            <div className="hidden md:flex w-8 justify-center text-xl font-black text-slate-600">{idx + 1}</div>
                                            <div className="flex-1 w-full relative">
                                                <Select options={playerOptions} value={pair.player2Id} onChange={(e) => updatePair(idx, 'player2Id', e.target.value)} className="w-full bg-slate-700 border-none text-white text-sm font-bold h-10"/>
                                            </div>
                                            <div className="text-lime-400 font-black text-xs">{totalPoints} pts</div>
                                            <div className="flex-1 w-full relative">
                                                <Select options={playerOptions} value={pair.player1Id} onChange={(e) => updatePair(idx, 'player1Id', e.target.value)} className="w-full bg-slate-700 border-none text-white text-sm font-bold h-10"/>
                                            </div>
                                            <button onClick={() => updatePair(idx, 'player1Id', '')} className="text-slate-600 hover:text-red-400"><X size={16}/></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuickLineupView;

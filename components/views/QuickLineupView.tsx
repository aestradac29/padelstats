
import React, { useState } from 'react';
import { Sparkles, Check, BrainCircuit, ArrowUpDown, Trash2, X, List, Shield, Trophy, Copy, Edit2, ChevronDown, ChevronUp } from '../Icons';
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
    const [showParser, setShowParser] = useState(true);
    const [draftLineup, setDraftLineup] = useState<{player1Id: string, player2Id: string}[]>(
        Array(5).fill({ player1Id: '', player2Id: '' })
    );
    const [editingIdx, setEditingIdx] = useState<number | null>(null);

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
            const pointsMatch = tempLine.match(/\b\d+(\.\d+)?\b/);
            if (pointsMatch) {
                const val = Number(pointsMatch[0]);
                if (!isNaN(val)) { initialPoints = val; tempLine = tempLine.replace(pointsMatch[0], ''); }
            }
            if (/\b(drive|derecha)\b/i.test(tempLine)) {
                position = Position.DRIVE; tempLine = tempLine.replace(/\b(drive|derecha)\b/i, '');
            } else if (/\b(reves|revés|back|backhand)\b/i.test(tempLine)) {
                position = Position.REVES; tempLine = tempLine.replace(/\b(reves|revés|back|backhand)\b/i, '');
            }
            if (/\b(zurdo|zurda|left|izq)\b/i.test(tempLine)) {
                handedness = 'left'; tempLine = tempLine.replace(/\b(zurdo|zurda|left|izq)\b/i, '');
            }
            let name = tempLine.replace(/[,;\t-]/g, ' ').replace(/\s+/g, ' ').trim();
            name = name.replace(/\b(puntos|pts|ptos)\b/i, '').trim();
            if (name) {
                parsedPlayers.push({
                    id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    name, position, handedness, initialPoints,
                    level: 3.0, matchesPlayed: 0, wins: 0
                });
            }
        }
        setPlayers(parsedPlayers);
        if (parsedPlayers.length > 0) setShowParser(false);
    };

    const sortPairs = (pairs: {player1Id: string, player2Id: string}[]) => {
        return [...pairs].sort((a, b) => {
            const pointsA = (players.find(p => p.id === a.player1Id)?.initialPoints || 0) + (players.find(p => p.id === a.player2Id)?.initialPoints || 0);
            const pointsB = (players.find(p => p.id === b.player1Id)?.initialPoints || 0) + (players.find(p => p.id === b.player2Id)?.initialPoints || 0);
            if ((!a.player1Id && !a.player2Id) && (b.player1Id || b.player2Id)) return 1;
            if ((a.player1Id || a.player2Id) && (!b.player1Id && !b.player2Id)) return -1;
            return pointsB - pointsA;
        });
    };

    const handleAIAutoFill = async () => {
        if (players.length < 2 || !opponentDesc) return;
        setIsThinking(true); setLineupAdvice('');
        try {
            const result = await getLineupSuggestion(players, players.map(p => p.id), opponentDesc);
            setLineupAdvice(result.reasoning);
            if (result.lineup && Array.isArray(result.lineup)) {
                let newDraft = [...draftLineup];
                result.lineup.forEach((pair, index) => {
                    if (index < 5) newDraft[index] = { player1Id: pair.player1Id || '', player2Id: pair.player2Id || '' };
                });
                if (autoSort) newDraft = sortPairs(newDraft);
                setDraftLineup(newDraft);
            }
        } catch (e) { console.error(e); } finally { setIsThinking(false); }
    };

    const handleCopyLineup = () => {
        let text = `🎾 *Alineación Rápida*\n`;
        if (opponentDesc) text += `🆚 Rival: ${opponentDesc}\n`;
        text += `\n`;
        let hasContent = false;
        // In QuickLineupView we don't have team settings, but we can check if there are 4 or 5 pairs filled
        // Or just output all non-empty pairs
        draftLineup.forEach((pair, index) => {
            const p1 = players.find(p => p.id === pair.player1Id);
            const p2 = players.find(p => p.id === pair.player2Id);
            if (p1 || p2) {
                hasContent = true;
                text += `${index + 1}️⃣ ${p2?.name || '___'} / ${p1?.name || '___'}\n`;
            }
        });
        if (!hasContent) return;
        text += `\n💪 ¡Vamos Equipo!`;
        navigator.clipboard.writeText(text).then(() => alert('✅ Alineación copiada'));
    };

    const updatePair = (index: number, field: 'player1Id' | 'player2Id', value: string) => {
        let newDraft = [...draftLineup];
        newDraft[index] = { ...newDraft[index], [field]: value };
        if (autoSort) newDraft = sortPairs(newDraft);
        setDraftLineup(newDraft);
    };

    const playerOptions = [
        { label: 'Seleccionar...', value: '' },
        ...[...players].sort((a, b) => b.initialPoints - a.initialPoints).map(p => ({
            label: `${p.name} (${p.position === Position.DRIVE ? 'D' : p.position === Position.REVES ? 'R' : 'A'}) — ${p.initialPoints} pts`,
            value: p.id
        }))
    ];

    const posColor = (pos: Position) =>
        pos === Position.DRIVE ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
        pos === Position.REVES ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
        'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in pb-24">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Sin cuenta</p>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Sparkles className="text-lime-500" size={28}/> Alineación Rápida
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Pega tu lista de jugadores y genera una alineación al instante.</p>
                </div>
                <div className="flex gap-2 items-center">
                    {players.length > 0 && (
                        <Button variant="secondary" onClick={() => setShowParser(!showParser)}>
                            {showParser ? 'Ver Pizarra →' : '← Editar Jugadores'}
                        </Button>
                    )}
                </div>
            </header>

            {showParser ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Input */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-6 space-y-4">
                        <h3 className="font-black text-base flex items-center gap-2 text-slate-900 dark:text-white">
                            <List size={18} className="text-blue-500"/> Pegar Jugadores
                        </h3>
                        <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-700 leading-relaxed">
                            Formato: <code className="font-mono text-blue-600 dark:text-blue-400">Nombre Posición Puntos</code><br/>
                            Ej: <code className="font-mono text-slate-600 dark:text-slate-400">Juan Drive 1500</code>
                        </p>
                        <textarea
                            className="w-full h-52 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-sm outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400 transition-all resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                            placeholder={"Juan García Drive 1500\nPedro López Revés 1320\nCarlos Ruiz Ambos 980\n..."}
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                        />
                        <Button
                            className="w-full justify-center"
                            onClick={handleParseText}
                            disabled={!bulkText.trim()}
                        >
                            <Check size={16}/> Procesar {bulkText.split('\n').filter(l => l.trim()).length} jugadores
                        </Button>
                    </div>

                    {/* Players detected */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-base flex items-center gap-2 text-slate-900 dark:text-white">
                                <Check size={18} className="text-lime-500"/> Jugadores Detectados
                            </h3>
                            {players.length > 0 && (
                                <span className="text-xs font-black bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400 px-2 py-0.5 rounded-full">
                                    {players.length} listos
                                </span>
                            )}
                        </div>

                        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                            {players.length === 0 ? (
                                <div className="text-center py-12 text-slate-300 dark:text-slate-600 italic text-sm">
                                    Pega tu lista y pulsa «Procesar»
                                </div>
                            ) : players.map((p, idx) => (
                                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                                            {p.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${posColor(p.position)}`}>
                                                    {p.position}
                                                </span>
                                                {p.handedness === 'left' && (
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 uppercase">Zurdo</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-sm text-lime-600 dark:text-lime-400">{p.initialPoints}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">pts</span>
                                        <button
                                            onClick={() => setPlayers(ps => ps.filter((_, i) => i !== idx))}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400 transition-all"
                                        >
                                            <X size={13}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {players.length > 0 && (
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex justify-between items-center">
                                <Button onClick={() => setShowParser(false)} className="flex-1 mr-2 justify-center">
                                    Ver Pizarra →
                                </Button>
                                <Button variant="danger" onClick={() => { setPlayers([]); setBulkText(''); }}>
                                    <Trash2 size={14}/>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                    {/* Left panel */}
                    <div className="xl:col-span-4 space-y-4">
                        {/* AI panel */}
                        <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-slate-900 text-white rounded-2xl shadow-xl relative overflow-hidden border border-blue-900/50">
                            <div className="absolute top-0 right-0 w-28 h-28 bg-lime-400 blur-[60px] opacity-15 rounded-full pointer-events-none"/>
                            <div className="px-5 py-4 border-b border-blue-900/40">
                                <h3 className="font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                                    <BrainCircuit size={16} className="text-lime-400"/> Asistente IA
                                </h3>
                            </div>
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-2 block">Descripción del Rival</label>
                                    <textarea
                                        className="w-full p-3 rounded-xl border border-blue-800/50 bg-blue-950/50 text-sm text-blue-100 focus:ring-2 focus:ring-lime-400/50 outline-none min-h-[72px] placeholder:text-slate-600 resize-none transition-all"
                                        placeholder="Ej. Pista rápida, rivales agresivos..."
                                        value={opponentDesc}
                                        onChange={(e) => setOpponentDesc(e.target.value)}
                                    />
                                </div>
                                <Button
                                    className="w-full justify-center font-black"
                                    onClick={handleAIAutoFill}
                                    disabled={!opponentDesc || isThinking || players.length < 2}
                                >
                                    {isThinking
                                        ? <><div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin"/> Calculando...</>
                                        : <><Sparkles size={14}/> Calcular Alineación</>
                                    }
                                </Button>
                            </div>
                        </div>

                        {/* AI report */}
                        {lineupAdvice && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 p-5 animate-in slide-in-from-bottom-4">
                                <h4 className="font-bold text-xs uppercase text-blue-700 dark:text-blue-300 mb-2.5 flex items-center gap-2">
                                    <Shield size={13}/> Informe Técnico IA
                                </h4>
                                <p className="text-xs text-blue-900/80 dark:text-blue-200/80 leading-relaxed whitespace-pre-wrap">{lineupAdvice}</p>
                            </div>
                        )}

                        {/* Player list summary */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Plantilla ({players.length})</h3>
                                <button onClick={() => setShowParser(true)} className="text-[10px] font-bold text-blue-500 hover:underline">Editar</button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {players.map(p => (
                                    <span key={p.id} className={`text-[10px] font-bold px-2 py-1 rounded-lg ${posColor(p.position)}`}>
                                        {p.name.split(' ')[0]} <span className="opacity-60">({p.initialPoints})</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Board */}
                    <div className="xl:col-span-8 space-y-3">
                        <div className="bg-slate-900 rounded-3xl p-5 md:p-7 shadow-2xl relative overflow-hidden border border-slate-800">
                            {/* Court decorations */}
                            <div className="absolute inset-6 border border-slate-800/60 rounded-xl pointer-events-none"/>
                            <div className="absolute top-1/2 left-6 right-6 h-px bg-slate-800/60 pointer-events-none"/>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-slate-800/40 rounded-full pointer-events-none"/>

                            <div className="flex justify-between items-center mb-5 relative z-10">
                                <div className="flex items-center gap-2">
                                    <Trophy size={16} className="text-amber-400"/>
                                    <h3 className="text-white font-black text-sm uppercase tracking-widest">Pizarra</h3>
                                    <span className="text-[10px] text-slate-500">
                                        {draftLineup.filter(p => p.player1Id || p.player2Id).length} parejas
                                    </span>
                                </div>
                                <div className="flex gap-1.5">
                                    <button onClick={handleCopyLineup} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-lime-400 transition-colors px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 uppercase tracking-wide">
                                        <Copy size={12}/> Copiar
                                    </button>
                                    <button onClick={() => setDraftLineup(Array(5).fill({ player1Id: '', player2Id: '' }))} className="p-1.5 text-slate-600 hover:text-red-400 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 relative z-10">
                                {draftLineup.map((pair, idx) => {
                                    const p1 = players.find(p => p.id === pair.player1Id);
                                    const p2 = players.find(p => p.id === pair.player2Id);
                                    const totalPoints = (p1?.initialPoints || 0) + (p2?.initialPoints || 0);
                                    const isFilled = pair.player1Id || pair.player2Id;

                                    return (
                                        <div key={idx} className={`group transition-all duration-200 ${!isFilled ? 'opacity-50 hover:opacity-75' : 'opacity-100'}`}>
                                            <div className={`bg-slate-800/60 border rounded-2xl p-3 flex flex-col md:flex-row items-center gap-3 transition-all ${isFilled ? 'border-slate-600 hover:border-slate-500' : 'border-slate-700/50 border-dashed'}`}>
                                                <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900/60 border border-slate-700/50 flex-shrink-0">
                                                    <span className={`text-lg font-black ${isFilled ? 'text-lime-400' : 'text-slate-600'}`}>{idx + 1}</span>
                                                </div>

                                                <div className="md:hidden w-full flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pareja {idx + 1}</span>
                                                    {totalPoints > 0 && <span className="text-[10px] bg-slate-900 text-lime-400 px-2 py-0.5 rounded-full font-mono border border-slate-700">{totalPoints} pts</span>}
                                                    <button onClick={() => updatePair(idx, 'player1Id', '')} className="text-slate-600 hover:text-red-400"><X size={13}/></button>
                                                </div>

                                                <div className="flex-1 w-full">
                                                    <div className="relative bg-slate-700/40 rounded-xl border border-orange-500/20 overflow-hidden">
                                                        <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-3 pt-1.5 pointer-events-none">
                                                            <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0"/>
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Revés</span>
                                                        </div>
                                                        <Select options={playerOptions} value={pair.player2Id} onChange={(e) => updatePair(idx, 'player2Id', e.target.value)} className="w-full bg-transparent border-none text-white text-sm font-bold pt-5 pb-2 px-3 h-auto focus:ring-0 cursor-pointer"/>
                                                    </div>
                                                </div>

                                                <div className="hidden md:flex flex-col items-center gap-0.5 w-14 flex-shrink-0">
                                                    {totalPoints > 0 ? (
                                                        <><span className="text-[9px] text-slate-500 font-bold uppercase">pts</span><span className="text-base font-black text-lime-400 leading-none">{totalPoints}</span></>
                                                    ) : <span className="text-slate-700 text-xl">·</span>}
                                                </div>

                                                <div className="flex-1 w-full">
                                                    <div className="relative bg-slate-700/40 rounded-xl border border-blue-500/20 overflow-hidden">
                                                        <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-3 pt-1.5 pointer-events-none">
                                                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"/>
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Drive</span>
                                                        </div>
                                                        <Select options={playerOptions} value={pair.player1Id} onChange={(e) => updatePair(idx, 'player1Id', e.target.value)} className="w-full bg-transparent border-none text-white text-sm font-bold pt-5 pb-2 px-3 h-auto focus:ring-0 cursor-pointer"/>
                                                    </div>
                                                </div>

                                                <button onClick={() => updatePair(idx, 'player1Id', '')} className="hidden md:block p-1.5 text-slate-600 hover:text-red-400 flex-shrink-0 transition-colors">
                                                    <X size={15}/>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex gap-6 justify-center text-[10px] uppercase font-bold text-slate-400 tracking-wider py-1">
                            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500"/>Revés (izq)</span>
                            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"/>Drive (der)</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuickLineupView;

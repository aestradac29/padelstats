

import React, { useState } from 'react';
import { Search, Plus, Clock, Edit2, Wand2, Table, ListFilter, MapPin, Trash2, ChevronDown, ChevronUp, AlertCircle } from '../Icons';
import { Button, Card } from '../UIComponents';
import { AppState, MatchDay, MatchResult } from '../../types';
import { formatDate } from '../../utils/helpers';
import { TANDA_OPTIONS } from '../../utils/constants';

interface MatchesViewProps {
    data: AppState | null;
    sessionRole: 'CAPTAIN' | 'GUEST';
    viewSeasonId: string;
    setTempMatch: (m: Partial<MatchDay>) => void;
    setModalType: (t: any) => void;
    setIsModalOpen: (o: boolean) => void;
    deleteMatch: (id: string) => void;
}

const MatchesView: React.FC<MatchesViewProps> = ({ 
    data, sessionRole, viewSeasonId, setTempMatch, setModalType, setIsModalOpen, deleteMatch
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'LIST' | 'TABLE'>('TABLE');
    const [expandedMatches, setExpandedMatches] = useState<string[]>([]);
    
    if (!data) return null;

    const getFilteredMatches = () => {
        if (viewSeasonId === 'all') return data.matches;
        return data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));
    };

    const matches = getFilteredMatches();
    
    // FILTER LOGIC
    const filteredBySearch = matches.filter(m => {
        const lowerTerm = searchTerm.toLowerCase().trim();
        if (!lowerTerm) return true;
        if (m.opponent.toLowerCase().includes(lowerTerm)) return true;
        if (m.lineups) {
            return m.lineups.some(l => {
                 const p1 = data?.players.find(p => p.id === l.player1Id);
                 const p2 = data?.players.find(p => p.id === l.player2Id);
                 if (p1 && (p1.name.toLowerCase().includes(lowerTerm) || (p1.surname && p1.surname.toLowerCase().includes(lowerTerm)))) return true;
                 if (p2 && (p2.name.toLowerCase().includes(lowerTerm) || (p2.surname && p2.surname.toLowerCase().includes(lowerTerm)))) return true;
                 if (l.opponent1Name && l.opponent1Name.toLowerCase().includes(lowerTerm)) return true;
                 if (l.opponent2Name && l.opponent2Name.toLowerCase().includes(lowerTerm)) return true;
                 return false;
            });
        }
        return false;
    });

    const sortedMatches = [...filteredBySearch].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const getMatchStatus = (m: MatchDay) => {
         const wins = m.lineups.filter(l => l.result === MatchResult.WIN).length;
         const losses = m.lineups.filter(l => l.result === MatchResult.LOSS).length;
         if (!m.lineups || m.lineups.length === 0) return 'PENDING';
         if (wins > losses) return 'WIN';
         if (losses > wins) return 'LOSS';
         return 'DRAW';
    };

    const getMatchScore = (m: MatchDay) => {
         const wins = m.lineups.filter(l => l.result === MatchResult.WIN).length;
         const losses = m.lineups.filter(l => l.result === MatchResult.LOSS).length;
         if (!m.lineups || m.lineups.length === 0) return '-';
         return `${wins} - ${losses}`;
    };

    const toggleMatchExpand = (id: string) => {
        setExpandedMatches(prev => 
            prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
        );
    };

    return (
      <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-300 pb-2">
        <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sticky top-0 bg-slate-50 dark:bg-slate-950 z-20 pt-2">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Jornadas</h2>
           
           <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
                {/* View Toggle */}
                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex items-center shadow-sm w-full md:w-auto">
                    <button onClick={() => setViewMode('TABLE')} className={`flex-1 md:flex-none p-2 rounded-md transition-all ${viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><Table size={18} className="mx-auto"/></button>
                    <button onClick={() => setViewMode('LIST')} className={`flex-1 md:flex-none p-2 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><ListFilter size={18} className="mx-auto"/></button>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar rival..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-lime-400 outline-none text-sm font-medium transition-all shadow-sm text-slate-900 dark:text-white"
                    />
                </div>
                {sessionRole === 'CAPTAIN' && (
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button 
                            variant="secondary"
                            onClick={() => { setModalType('GENERATE_CALENDAR'); setIsModalOpen(true); }}
                            className="flex-1 md:flex-none justify-center"
                        >
                            <Wand2 size={18} className="text-lime-600 dark:text-lime-400"/> <span className="hidden md:inline">Generar</span>
                        </Button>
                        <Button 
                            onClick={() => { setTempMatch({ date: new Date().toISOString().slice(0, 16), isHome: true, lineups: [], tandas: '5', ignorePoints: false }); setModalType('ADD_MATCH'); setIsModalOpen(true); }}
                            className="flex-1 md:flex-none justify-center px-4"
                        >
                            <Plus size={18} /> <span className="hidden md:inline">Nuevo</span>
                        </Button>
                    </div>
                )}
           </div>
        </header>
        
        {sortedMatches.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <div className="inline-flex bg-white dark:bg-slate-800 p-3 rounded-full mb-3 shadow-sm">
                    <Search className="text-slate-300 dark:text-slate-600" size={24} />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No se encontraron partidos. ¡Genera el calendario o crea una jornada!</p>
                {sessionRole === 'CAPTAIN' && (
                    <button onClick={() => { setModalType('GENERATE_CALENDAR'); setIsModalOpen(true); }} className="mt-4 text-blue-600 dark:text-blue-400 font-bold hover:underline">Generar Calendario de Temporada</button>
                )}
            </div>
        ) : (
            <>
            {/* TABLE VIEW (Hidden on Mobile) */}
            <div className={`${viewMode === 'TABLE' ? 'hidden md:block' : 'hidden'}`}>
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                    <th className="p-3 font-bold text-center w-16 border-r border-slate-200 dark:border-slate-700">Jornada</th>
                                    <th className="p-3 font-bold w-48 border-r border-slate-200 dark:border-slate-700">Fecha y Hora</th>
                                    <th className="p-3 font-bold w-32 border-r border-slate-200 dark:border-slate-700">Sede</th>
                                    <th className="p-3 font-bold border-r border-slate-200 dark:border-slate-700">Rival</th>
                                    <th className="p-3 font-bold text-center w-24">Resultado</th>
                                    {sessionRole === 'CAPTAIN' && <th className="p-3 font-bold text-right w-24">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sortedMatches.map((match, idx) => {
                                    const status = getMatchStatus(match);
                                    let rowBg = "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"; 
                                    let resultStyle = "text-slate-400 dark:text-slate-500";
                                    
                                    if (match.isRestDay) {
                                        rowBg = "bg-slate-100 dark:bg-slate-800 opacity-60";
                                        resultStyle = "text-slate-500 italic";
                                    } else if (status === 'WIN') {
                                        rowBg = "bg-lime-50 dark:bg-lime-900/10 hover:bg-lime-100 dark:hover:bg-lime-900/20";
                                        resultStyle = "text-lime-700 dark:text-lime-400 font-black";
                                    } else if (status === 'LOSS') {
                                        rowBg = "bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20";
                                        resultStyle = "text-red-700 dark:text-red-400 font-black";
                                    } else if (status === 'DRAW') {
                                        rowBg = "bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20";
                                        resultStyle = "text-blue-700 dark:text-blue-400 font-black";
                                    }
                                    
                                    const dateObj = new Date(match.date);
                                    const dateStr = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();
                                    const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                                    return (
                                        <tr key={match.id} className={`${rowBg} transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0`}>
                                            <td className="p-3 text-center border-r border-slate-200/50 dark:border-slate-700/50">
                                                <span className="font-black text-slate-700 dark:text-slate-300 text-lg">{idx + 1}</span>
                                            </td>
                                            <td className="p-3 border-r border-slate-200/50 dark:border-slate-700/50">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{dateStr}</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">{timeStr}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 border-r border-slate-200/50 dark:border-slate-700/50">
                                                <div className="flex flex-col">
                                                     <div className="flex gap-1 mb-1">
                                                         <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded w-fit ${match.isRestDay ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : match.isHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                                                            {match.isRestDay ? 'DESCANSO' : match.isHome ? 'CASA' : 'FUERA'}
                                                         </span>
                                                         {match.ignorePoints && !match.isRestDay && (
                                                             <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded w-fit bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" title="Histórico: No suma puntos">
                                                                 HIST
                                                             </span>
                                                         )}
                                                     </div>
                                                     <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={match.notes || (match.isHome ? 'Local' : match.opponent)}>
                                                         {match.isRestDay ? 'Jornada de descanso' : (match.notes?.replace('Sede: ', '') || (match.isHome ? 'Local' : match.opponent))}
                                                     </span>
                                                </div>
                                            </td>
                                            <td className="p-3 border-r border-slate-200/50 dark:border-slate-700/50">
                                                <span className="font-bold text-slate-900 dark:text-white text-sm uppercase">{match.isRestDay ? '-' : match.opponent}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`text-lg ${resultStyle}`}>
                                                    {match.isRestDay ? '---' : (status === 'PENDING' ? '-' : getMatchScore(match))}
                                                </span>
                                            </td>
                                            {sessionRole === 'CAPTAIN' && (
                                                <td className="p-3 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <button 
                                                            onClick={() => { setTempMatch(match); setModalType('EDIT_MATCH'); setIsModalOpen(true); }}
                                                            className="text-slate-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-white/50 dark:hover:bg-slate-800"
                                                            title="Editar"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => deleteMatch(match.id)}
                                                            className="text-slate-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* LIST VIEW (Optimized for Mobile) & Fallback for Table on Mobile */}
            <div className={`space-y-3 pb-24 ${viewMode === 'TABLE' ? 'md:hidden block' : 'block'}`}>
                {sortedMatches.map((match, matchIdx) => {
                    const status = getMatchStatus(match);
                    const isExpanded = expandedMatches.includes(match.id);
                    const score = getMatchScore(match);

                    const statusConfig: Record<string, { border: string, bg: string, dot: string, scoreColor: string, label: string }> = {
                        WIN:     { border: 'border-l-lime-400', bg: isExpanded ? 'bg-lime-50/30 dark:bg-lime-900/5' : '', dot: 'bg-lime-400', scoreColor: 'text-lime-600 dark:text-lime-400', label: 'Victoria' },
                        LOSS:    { border: 'border-l-red-400',  bg: isExpanded ? 'bg-red-50/30 dark:bg-red-900/5'  : '', dot: 'bg-red-400',  scoreColor: 'text-red-500 dark:text-red-400',   label: 'Derrota'  },
                        DRAW:    { border: 'border-l-blue-400', bg: isExpanded ? 'bg-blue-50/30 dark:bg-blue-900/5' : '', dot: 'bg-blue-400', scoreColor: 'text-blue-500 dark:text-blue-400', label: 'Empate'   },
                        PENDING: { border: 'border-l-slate-200 dark:border-l-slate-700', bg: '', dot: 'bg-slate-300 dark:bg-slate-600', scoreColor: 'text-slate-400', label: 'Pendiente' },
                    };
                    const cfg = statusConfig[status] || statusConfig.PENDING;

                    if (match.isRestDay) {
                        return (
                            <div key={match.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-slate-300 bg-slate-100 dark:bg-slate-900 opacity-70 transition-all shadow-sm">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">DESCANSO</span>
                                        <h3 className="text-base font-black text-slate-500 dark:text-slate-400">Jornada de descanso</h3>
                                    </div>
                                    <span className="text-slate-400 dark:text-slate-500 text-[10px] font-medium">
                                        {new Date(match.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={match.id} className={`rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 ${cfg.border} overflow-hidden bg-white dark:bg-slate-900 ${cfg.bg} transition-all shadow-sm hover:shadow-md`}>
                            {/* Card Header */}
                            <div className="p-4 cursor-pointer" onClick={() => toggleMatchExpand(match.id)}>
                                <div className="flex items-start justify-between gap-3">
                                    {/* Left: date + badges */}
                                    <div className="flex flex-col gap-1.5 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${match.isHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                                                {match.isHome ? '🏠 Casa' : '✈️ Fuera'}
                                            </span>
                                            {match.ignorePoints && (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">Histórico</span>
                                            )}
                                            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-medium">
                                                {new Date(match.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                {' · '}
                                                {new Date(match.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}h
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">J{matchIdx + 1}</span>
                                            <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                                                vs {match.opponent.toUpperCase()}
                                            </h3>
                                        </div>
                                        {match.notes && (
                                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{match.notes}</p>
                                        )}
                                    </div>

                                    {/* Right: score + chevron */}
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-right">
                                            {status !== 'PENDING' ? (
                                                <>
                                                    <div className={`text-2xl font-black leading-none ${cfg.scoreColor}`}>{score}</div>
                                                    <div className={`text-[10px] font-black uppercase mt-0.5 ${cfg.scoreColor} opacity-70`}>{cfg.label}</div>
                                                </>
                                            ) : (
                                                <div className="text-xs font-bold text-slate-300 dark:text-slate-600 italic">—</div>
                                            )}
                                        </div>
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isExpanded ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800'} text-slate-400`}>
                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                    {/* Actions row (captain) */}
                                    {sessionRole === 'CAPTAIN' && (
                                        <div className="flex gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setTempMatch(match); setModalType('EDIT_MATCH'); setIsModalOpen(true); }}
                                                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={12} /> Editar
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteMatch(match.id); }}
                                                className="flex items-center gap-1.5 text-xs font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={12} /> Eliminar
                                            </button>
                                            {match.tandas && match.tandas !== '5' && (
                                                <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600">
                                                    {TANDA_OPTIONS.find(o => o.value === match.tandas)?.label || match.tandas}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Lineups */}
                                    <div className="p-3 space-y-2">
                                        {match.ignorePoints && (
                                            <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                                <AlertCircle size={12} className="flex-shrink-0" />
                                                Partido histórico — no suma puntos a la clasificación
                                            </div>
                                        )}
                                        {(!match.lineups || match.lineups.length === 0) ? (
                                            <p className="text-center py-4 text-xs text-slate-400 italic">Sin resultados registrados aún</p>
                                        ) : match.lineups.map((lineup, idx) => {
                                            const p1 = data?.players.find(p => p.id === lineup.player1Id);
                                            const p2 = data?.players.find(p => p.id === lineup.player2Id);
                                            const isWin = lineup.result === MatchResult.WIN;
                                            const isLoss = lineup.result === MatchResult.LOSS;

                                            return (
                                                <div key={idx} className={`rounded-xl border overflow-hidden ${isWin ? 'border-lime-200 dark:border-lime-800/40 bg-lime-50 dark:bg-lime-900/10' : isLoss ? 'border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                                                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                                                        {/* Pair names */}
                                                        <div className="min-w-0">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Pareja {idx + 1}</p>
                                                            <p className={`text-xs font-bold truncate ${isWin ? 'text-lime-800 dark:text-lime-300' : isLoss ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                                                {p1?.name || '?'} <span className="opacity-50">/</span> {p2?.name || '?'}
                                                            </p>
                                                            {(lineup.opponent1Name || lineup.opponent2Name) && (
                                                                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                                    vs {lineup.opponent1Name || '?'} / {lineup.opponent2Name || '?'}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {/* Sets */}
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            {[lineup.set1, lineup.set2, lineup.set3].filter(Boolean).map((set, si) => (
                                                                <span key={si} className={`text-[11px] font-black px-2 py-1 rounded-lg border ${isWin ? 'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300 dark:border-lime-800/50' : isLoss ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50' : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                                                                    {set}
                                                                </span>
                                                            ))}
                                                            <span className={`text-[10px] font-black uppercase ml-1 ${isWin ? 'text-lime-600 dark:text-lime-400' : isLoss ? 'text-red-500 dark:text-red-400' : 'text-blue-500'}`}>
                                                                {isWin ? '✓' : isLoss ? '✗' : '~'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            </>
        )}
      </div>
    );
};

export default MatchesView;
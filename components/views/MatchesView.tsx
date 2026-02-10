

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
      <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-300">
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
                                    
                                    if (status === 'WIN') {
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
                                                         <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded w-fit ${match.isHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                                                            {match.isHome ? 'CASA' : 'FUERA'}
                                                         </span>
                                                         {match.ignorePoints && (
                                                             <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded w-fit bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" title="Histórico: No suma puntos">
                                                                 HIST
                                                             </span>
                                                         )}
                                                     </div>
                                                     <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={match.notes || (match.isHome ? 'Local' : match.opponent)}>
                                                         {match.notes?.replace('Sede: ', '') || (match.isHome ? 'Local' : match.opponent)}
                                                     </span>
                                                </div>
                                            </td>
                                            <td className="p-3 border-r border-slate-200/50 dark:border-slate-700/50">
                                                <span className="font-bold text-slate-900 dark:text-white text-sm uppercase">{match.opponent}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`text-lg ${resultStyle}`}>
                                                    {status === 'PENDING' ? '-' : getMatchScore(match)}
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
            <div className={`space-y-4 pb-20 ${viewMode === 'TABLE' ? 'md:hidden block' : 'block'}`}>
                {sortedMatches.map(match => {
                    const status = getMatchStatus(match);
                    const isExpanded = expandedMatches.includes(match.id);
                    const borderColor = status === 'WIN' ? 'border-l-lime-500' : status === 'LOSS' ? 'border-l-red-500' : status === 'DRAW' ? 'border-l-blue-500' : 'border-l-slate-300 dark:border-l-slate-600';
                    const bgColor = isExpanded ? 'bg-white dark:bg-slate-800' : 'bg-white dark:bg-slate-900';
                    
                    return (
                        <div key={match.id} className={`rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 border-l-4 ${borderColor} overflow-hidden ${bgColor} transition-all`}>
                            {/* Card Header (Always Visible) */}
                            <div className="p-4 cursor-pointer" onClick={() => toggleMatchExpand(match.id)}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${match.isHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>{match.isHome ? 'Casa' : 'Fuera'}</span>
                                        {match.ignorePoints && (
                                             <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">HIST</span>
                                        )}
                                        <span className="text-slate-400 font-bold text-[10px] uppercase flex items-center gap-1"><Clock size={10} /> {formatDate(match.date)}</span>
                                    </div>
                                    {sessionRole === 'CAPTAIN' && isExpanded && (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setTempMatch(match); setModalType('EDIT_MATCH'); setIsModalOpen(true); }}
                                                className="p-1.5 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); deleteMatch(match.id); }}
                                                className="p-1.5 text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex justify-between items-center mt-1">
                                    <h3 className="text-base font-black text-slate-900 dark:text-white truncate pr-2">vs {match.opponent}</h3>
                                    <div className="flex items-center gap-2">
                                        {status !== 'PENDING' && (
                                            <span className={`text-xl font-black ${status === 'WIN' ? 'text-lime-600 dark:text-lime-400' : status === 'LOSS' ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400'}`}>
                                                {getMatchScore(match)}
                                            </span>
                                        )}
                                        {status === 'PENDING' && <span className="text-xs font-bold text-slate-300 dark:text-slate-600 italic">Pendiente</span>}
                                        <div className="text-slate-300 dark:text-slate-600 ml-1">
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details (Lineups) */}
                            {isExpanded && (
                                <div className="bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 p-2 animate-in slide-in-from-top-2 duration-200">
                                    {match.tandas && match.tandas !== '5' && (
                                        <div className="flex justify-center mb-2">
                                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm border border-slate-200 dark:border-slate-600">
                                                {TANDA_OPTIONS.find(o => o.value === match.tandas)?.label || match.tandas}
                                            </span>
                                        </div>
                                    )}
                                    {match.ignorePoints && (
                                        <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-900/30 flex items-start gap-2">
                                            <AlertCircle size={14} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                                            <p className="text-[10px] text-yellow-700 dark:text-yellow-300">
                                                Este partido está marcado como histórico. Cuenta para estadísticas pero no suma puntos a la clasificación.
                                            </p>
                                        </div>
                                    )}
                                    {(!match.lineups || match.lineups.length === 0) ? (
                                        <div className="text-center py-3 text-xs text-slate-400 italic">
                                            Sin resultados registrados.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2">
                                            {match.lineups.map((lineup, idx) => {
                                                const p1 = data?.players.find(p => p.id === lineup.player1Id);
                                                const p2 = data?.players.find(p => p.id === lineup.player2Id);
                                                
                                                // Determine Result Colors
                                                const isWin = lineup.result === MatchResult.WIN;
                                                const isLoss = lineup.result === MatchResult.LOSS;
                                                const stripColor = isWin ? 'bg-lime-500' : isLoss ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600';
                                                const scoreBg = isWin ? 'bg-lime-50 text-lime-700 border-lime-100 dark:bg-lime-900/20 dark:text-lime-400 dark:border-lime-900/30' : isLoss ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30' : 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';

                                                return (
                                                    <div key={idx} className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-full">
                                                        {/* Color Strip */}
                                                        <div className={`w-1 ${stripColor} flex-shrink-0`}></div>
                                                        
                                                        {/* Content */}
                                                        <div className="flex-1 p-2 flex items-center justify-between gap-2 overflow-hidden">
                                                            <div className="flex flex-col min-w-0 justify-center">
                                                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                                                                    {p1?.name} {p1?.surname || ''} <span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span> {p2?.name} {p2?.surname || ''}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                                                    {(lineup.opponent1Name || lineup.opponent2Name) 
                                                                        ? <><span className="opacity-50">vs</span> {lineup.opponent1Name || '?'} / {lineup.opponent2Name || '?'}</>
                                                                        : <span className="opacity-50 italic">Rival no registrado</span>
                                                                    }
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Score */}
                                                            <div className={`flex gap-1 font-mono text-[10px] font-black whitespace-nowrap`}>
                                                                <span className={`px-1.5 py-0.5 rounded border ${scoreBg}`}>{lineup.set1}</span>
                                                                <span className={`px-1.5 py-0.5 rounded border ${scoreBg}`}>{lineup.set2}</span>
                                                                {lineup.set3 && <span className={`px-1.5 py-0.5 rounded border ${scoreBg}`}>{lineup.set3}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
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
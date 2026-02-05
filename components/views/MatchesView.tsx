import React, { useState } from 'react';
import { Search, Plus, Clock, Edit2 } from '../Icons';
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
}

const MatchesView: React.FC<MatchesViewProps> = ({ 
    data, sessionRole, viewSeasonId, setTempMatch, setModalType, setIsModalOpen 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    if (!data) return null;

    const getFilteredMatches = () => {
        if (viewSeasonId === 'all') return data.matches;
        return data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));
    };

    const matches = getFilteredMatches();
    
    // FILTER LOGIC: Search in Opponent Name, Local Player Name, Rival Player Name
    const filteredBySearch = matches.filter(m => {
        const lowerTerm = searchTerm.toLowerCase().trim();
        if (!lowerTerm) return true;

        // 1. Check Opponent Team Name
        if (m.opponent.toLowerCase().includes(lowerTerm)) return true;

        // 2. Check Lineups (Players)
        if (m.lineups) {
            return m.lineups.some(l => {
                 // Check Local Players (resolve ID to Name)
                 const p1 = data?.players.find(p => p.id === l.player1Id);
                 const p2 = data?.players.find(p => p.id === l.player2Id);
                 
                 if (p1 && (p1.name.toLowerCase().includes(lowerTerm) || (p1.surname && p1.surname.toLowerCase().includes(lowerTerm)))) return true;
                 if (p2 && (p2.name.toLowerCase().includes(lowerTerm) || (p2.surname && p2.surname.toLowerCase().includes(lowerTerm)))) return true;

                 // Check Rival Players (direct strings)
                 if (l.opponent1Name && l.opponent1Name.toLowerCase().includes(lowerTerm)) return true;
                 if (l.opponent2Name && l.opponent2Name.toLowerCase().includes(lowerTerm)) return true;

                 return false;
            });
        }
        return false;
    });

    const sortedMatches = [...filteredBySearch].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return (
      <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
        <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-200 pb-6">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Jornadas y Resultados</h2>
           
           <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar rival o jugador..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none text-sm font-medium transition-all"
                    />
                </div>
                {sessionRole === 'CAPTAIN' && (
                    <Button onClick={() => { setTempMatch({ date: new Date().toISOString().slice(0, 16), isHome: true, lineups: [], tandas: '5' }); setModalType('ADD_MATCH'); setIsModalOpen(true); }}><Plus size={18} /> Nueva Jornada</Button>
                )}
           </div>
        </header>
        
        {sortedMatches.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="inline-flex bg-white p-3 rounded-full mb-3 shadow-sm">
                    <Search className="text-slate-300" size={24} />
                </div>
                <p className="text-slate-500 font-medium">No se encontraron partidos que coincidan con tu búsqueda.</p>
            </div>
        ) : (
            <div className="space-y-6">
                {sortedMatches.map(match => (
                    <Card key={match.id} className="hover:shadow-md transition-shadow relative">
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${match.isHome ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{match.isHome ? 'Casa' : 'Fuera'}</span>
                                    <span className="text-slate-400 font-bold text-xs uppercase flex items-center gap-1"><Clock size={12} /> {formatDate(match.date)}</span>
                                </div>
                                <h3 className="text-xl font-black text-slate-900">vs {match.opponent}</h3>
                                {match.tandas && (
                                <div className="mt-2 inline-flex items-center bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">
                                    Formato Jornada: {TANDA_OPTIONS.find(o => o.value === match.tandas)?.label || match.tandas}
                                </div>
                                )}
                            </div>
                            {sessionRole === 'CAPTAIN' && (
                                <Button variant="secondary" className="text-xs h-8" onClick={() => { setTempMatch(match); setModalType('EDIT_MATCH'); setIsModalOpen(true); }}><Edit2 size={14} /> Editar</Button>
                            )}
                        </div>
                        <div className="space-y-4">
                            {match.lineups.map((lineup, idx) => {
                                const p1 = data?.players.find(p => p.id === lineup.player1Id);
                                const p2 = data?.players.find(p => p.id === lineup.player2Id);
                                return (
                                    <div key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-xl bg-slate-50 border border-slate-100 gap-4 transition-all hover:bg-white hover:shadow-sm">
                                        <div className="flex-1 flex items-center gap-4">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-200 text-blue-800 flex flex-shrink-0 items-center justify-center font-black text-xs" title={`Pareja ${idx + 1}`}>
                                                {idx + 1}
                                            </div>
                                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${lineup.result === MatchResult.WIN ? 'bg-lime-500 shadow-sm shadow-lime-500/50' : lineup.result === MatchResult.LOSS ? 'bg-red-500 shadow-sm shadow-red-500/50' : 'bg-slate-400'}`}></div>
                                            <div className="flex flex-col">
                                                <div className="text-sm font-black text-slate-800 tracking-tight">
                                                {p1?.name} {p1?.surname || ''} / {p2?.name} {p2?.surname || ''}
                                                </div>
                                                {(lineup.opponent1Name || lineup.opponent2Name) && (
                                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                                                    vs <span className="text-slate-600">{lineup.opponent1Name || 'Rival 1'}</span> / <span className="text-slate-600">{lineup.opponent2Name || 'Rival 2'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-4">
                                            <div className="flex gap-2">
                                                <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-mono font-black text-sm text-blue-600 shadow-xs">{lineup.set1}</span>
                                                <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-mono font-black text-sm text-blue-600 shadow-xs">{lineup.set2}</span>
                                                {lineup.set3 && <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-mono font-black text-sm text-blue-600 shadow-xs">{lineup.set3}</span>}
                                            </div>
                                            <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-md min-w-[70px] text-center ${lineup.result === MatchResult.WIN ? 'text-lime-700 bg-lime-100' : lineup.result === MatchResult.LOSS ? 'text-red-700 bg-red-100' : 'text-slate-500 bg-slate-100'}`}>
                                            {lineup.result}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </Card>
                ))}
            </div>
        )}
      </div>
    );
};

export default MatchesView;

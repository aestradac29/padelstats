
import React, { useState, useEffect } from 'react';
import { Shield, Trash2, Check, X, Edit2, Copy } from '../Icons';
import { Button, Card, Input, Select } from '../UIComponents';
import { AppState, Season, TeamSettings, MatchResult } from '../../types';
import { DEFAULT_SETTINGS, PRESET_RANGES } from '../../utils/constants';
import { recalculateStats } from '../../utils/helpers';

interface SettingsViewProps {
    data: AppState | null;
    teamId: string | null;
    viewSeasonId: string;
    setViewSeasonId: (id: string) => void;
    sessionRole: 'CAPTAIN' | 'GUEST';
    updateTeamData: (teamId: string, data: Partial<AppState>) => Promise<void>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
    data, teamId, viewSeasonId, setViewSeasonId, sessionRole, updateTeamData 
}) => {
    const isGlobalView = viewSeasonId === 'all';
    const currentSeason = data?.seasons?.find(s => s.id === viewSeasonId);
    const [localSettings, setLocalSettings] = useState<TeamSettings>( currentSeason?.settings || data?.settings || DEFAULT_SETTINGS );
    const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);
    const [newSeasonName, setNewSeasonName] = useState('');
    const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
    const [tempSeasonName, setTempSeasonName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    useEffect(() => { 
        if (currentSeason?.settings) setLocalSettings(currentSeason.settings); 
        else if (data?.settings) setLocalSettings(data.settings); 
    }, [viewSeasonId, data]);

    // Auto-detect selected category based on range values
    useEffect(() => {
        if (localSettings.ranges) {
            const match = Object.entries(PRESET_RANGES).find(([key, val]) => JSON.stringify(val) === JSON.stringify(localSettings.ranges));
            if (match) setSelectedCategory(match[0]);
            else setSelectedCategory('');
        }
    }, [localSettings.ranges]);

    if (!data) return null;

    const handleSave = async () => {
        if (!teamId || isGlobalView) return;
        const updatedSeasons = [...(data.seasons || [])];
        const idx = updatedSeasons.findIndex(s => s.id === viewSeasonId);
        if (idx >= 0) {
            updatedSeasons[idx] = { ...updatedSeasons[idx], settings: localSettings };
            await updateTeamData(teamId, { seasons: updatedSeasons });
            alert("Configuración de temporada guardada");
        }
    }

    const updateRange = (index: number, field: keyof TeamSettings['ranges'][0], value: number) => {
        const newRanges = [...(localSettings.ranges || [])];
        if(!newRanges[index]) return;
        newRanges[index] = { ...newRanges[index], [field]: value };
        setLocalSettings({...localSettings, ranges: newRanges});
    }

    const addRange = () => setLocalSettings(prev => ({ ...prev, ranges: [...(prev.ranges || []), { min: 0, max: 0, win: 0, loss: 0 }] }));
    const removeRange = (index: number) => setLocalSettings(prev => ({ ...prev, ranges: prev.ranges.filter((_, i) => i !== index) }));

    const addNewSeason = async () => {
        if(!newSeasonName || !teamId) return;
        const newSeason: Season = { id: Date.now().toString(), name: newSeasonName, isActive: true, settings: DEFAULT_SETTINGS, playerStartPoints: {} };
        const updatedSeasons = (data.seasons || []).map(s => ({...s, isActive: false}));
        updatedSeasons.push(newSeason);
        await updateTeamData(teamId, { seasons: updatedSeasons });
        setNewSeasonName('');
    };

    const setSeasonActive = async (id: string) => {
        if(!teamId) return;
        const updatedSeasons = (data.seasons || []).map(s => ({...s, isActive: s.id === id}));
        await updateTeamData(teamId, { seasons: updatedSeasons });
    };

    const startEditingSeason = (season: Season) => { setEditingSeasonId(season.id); setTempSeasonName(season.name); };
    
    const saveSeasonName = async () => {
        if(!teamId || !editingSeasonId || !tempSeasonName.trim()) return;
        const updatedSeasons = (data.seasons || []).map(s => s.id === editingSeasonId ? { ...s, name: tempSeasonName } : s);
        await updateTeamData(teamId, { seasons: updatedSeasons });
        setEditingSeasonId(null);
    };

    // --- EXECUTE DELETE (Called from UI Modal) ---
    const executeDeleteSeason = async () => {
        if (!seasonToDelete || !teamId || !data) return;
        
        const seasonId = seasonToDelete.id;
        const currentSeasons = data.seasons || [];
        
        // Helper: Firestore throws errors if we send 'undefined', so we sanitize the object.
        const sanitize = (obj: any) => JSON.parse(JSON.stringify(obj));

        try {
            // 1. Calculate New State (Immutable)
            let nextSeasons = currentSeasons.filter(s => String(s.id) !== String(seasonId));
            
            // Handle Active Season Re-assignment
            const wasActive = seasonToDelete.isActive;
            const isAnyActive = nextSeasons.some(s => s.isActive);

            if (wasActive && !isAnyActive && nextSeasons.length > 0) {
                 // Force the first available season to be active
                 nextSeasons = nextSeasons.map((season, index) => {
                    if (index === 0) return { ...season, isActive: true };
                    return { ...season, isActive: false };
                 });
            }

            // Filter Matches
            const nextMatches = data.matches.filter(m => {
                const mSeasonId = m.seasonId || 'default';
                return String(mSeasonId) !== String(seasonId);
            });

            // Recalculate Player Stats based on remaining matches
            const nextPlayers = recalculateStats(data.players, nextMatches);

            // 2. DB Update
            await updateTeamData(teamId, sanitize({ 
                seasons: nextSeasons, 
                matches: nextMatches,
                players: nextPlayers
            }));

            // 3. Update View State & Close Modal
            if (viewSeasonId === seasonId) {
                const newActive = nextSeasons.find(s => s.isActive);
                setViewSeasonId(newActive ? newActive.id : 'all');
            }
            
            setSeasonToDelete(null); // Close Modal

        } catch (error: any) {
            console.error("Delete Season Error:", error);
            alert(`Error al eliminar la temporada: ${error.message || error}`);
            setSeasonToDelete(null); // Close Modal even on error
        }
    };

    if (sessionRole !== 'CAPTAIN') return <div className="p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl font-bold">Acceso restringido a capitanes.</div>
    
    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in pb-24 relative">
            
            {/* Delete season modal */}
            {seasonToDelete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4 text-center animate-in fade-in">
                      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700">
                        <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Shield className="text-red-500" size={24}/>
                        </div>
                        <h4 className="text-slate-900 dark:text-white font-black text-xl mb-2">¿Eliminar Temporada?</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                            Se eliminará <strong className="text-slate-800 dark:text-slate-200">"{seasonToDelete.name}"</strong> y todos sus partidos. Esta acción es irreversible.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSeasonToDelete(null)}
                                className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeDeleteSeason}
                                className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20"
                            >
                                <Trash2 size={16}/> Eliminar
                            </button>
                        </div>
                      </div>
                  </div>
            )}

            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 pb-5">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Configuración</p>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">Ajustes del Equipo</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestiona temporadas y sistema de puntuación.</p>
            </header>

            {/* Team ID card - for sharing with guests */}
            {teamId && (
                <div className="bg-gradient-to-r from-blue-950 to-blue-900 rounded-2xl border border-blue-800 p-5 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-lime-400 blur-[60px] opacity-10 rounded-full pointer-events-none"/>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-black text-blue-300 uppercase tracking-widest mb-1">Código de equipo</p>
                            <p className="text-white font-black text-lg tracking-tight">{data?.teamName}</p>
                            <p className="text-blue-300 text-sm font-mono mt-1 break-all">{teamId}</p>
                            <p className="text-blue-400 text-xs mt-2">Comparte este código con tus jugadores para que puedan ver las estadísticas del equipo.</p>
                        </div>
                        <button
                            onClick={() => { navigator.clipboard.writeText(teamId); alert('Código copiado al portapapeles'); }}
                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-xs rounded-xl transition-colors uppercase tracking-wide"
                        >
                            <Copy size={14}/> Copiar
                        </button>
                    </div>
                </div>
            )}

            {/* Team Settings */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Shield size={15} className="text-blue-600 dark:text-blue-400"/>
                    </div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white">Ajustes Generales</h3>
                </div>
                <div className="p-6 space-y-5">
                    <Select
                        label="Categoría del Equipo (Masculino / Femenino)"
                        value={data?.settings?.gender || 'MASCULINO'}
                        onChange={async (e) => {
                            const newGender = e.target.value as 'MASCULINO' | 'FEMENINO';
                            setLocalSettings(s => ({ ...s, gender: newGender }));
                            if (teamId) {
                                await updateTeamData(teamId, { 
                                    settings: { ...(data?.settings || DEFAULT_SETTINGS), gender: newGender } 
                                });
                            }
                        }}
                        options={[
                            { label: 'Masculino (5 partidos por jornada)', value: 'MASCULINO' },
                            { label: 'Femenino (4 partidos por jornada)', value: 'FEMENINO' }
                        ]}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Esto ajustará automáticamente las opciones de "Tandas" al crear o editar jornadas.
                    </p>
                </div>
            </div>

            {/* Temporadas */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Shield size={15} className="text-blue-600 dark:text-blue-400"/>
                    </div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white">Temporadas</h3>
                </div>
                <div className="p-6 space-y-5">
                    {/* Add season */}
                    <div className="flex gap-2">
                        <Input
                          placeholder="Nombre de la nueva temporada (ej. 2025-26)"
                          value={newSeasonName}
                          onChange={(e) => setNewSeasonName(e.target.value)}
                        />
                        <Button onClick={addNewSeason} disabled={!newSeasonName} className="flex-shrink-0">
                          Crear
                        </Button>
                    </div>

                    {/* Season list */}
                    <div className="space-y-2">
                        {(data.seasons || []).map(s => (
                            <div key={s.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${s.isActive ? 'bg-lime-50 dark:bg-lime-900/10 border-lime-300 dark:border-lime-700' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'}`}>
                                {editingSeasonId === s.id ? (
                                   <div className="flex gap-2 flex-1 items-center">
                                       <input
                                         type="text"
                                         value={tempSeasonName}
                                         onChange={(e) => setTempSeasonName(e.target.value)}
                                         className="flex-1 px-3 py-2 text-sm border-2 border-blue-300 dark:border-blue-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-400/40"
                                         autoFocus
                                       />
                                       <button onClick={saveSeasonName} className="bg-lime-400 text-blue-950 p-2 rounded-lg hover:bg-lime-300 transition-colors"><Check size={16}/></button>
                                       <button onClick={() => setEditingSeasonId(null)} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"><X size={16}/></button>
                                   </div>
                                ) : (
                                   <div className="flex-1 flex items-center justify-between gap-2">
                                       <div>
                                           <div className="flex items-center gap-2">
                                             <span className={`font-black text-sm ${s.isActive ? 'text-lime-800 dark:text-lime-300' : 'text-slate-700 dark:text-slate-300'}`}>{s.name}</span>
                                             {s.isActive && (
                                               <span className="text-[10px] font-black text-lime-600 dark:text-lime-400 bg-lime-100 dark:bg-lime-900/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Activa</span>
                                             )}
                                           </div>
                                       </div>
                                       <div className="flex items-center gap-1.5 flex-shrink-0">
                                           <button onClick={() => startEditingSeason(s)} className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors" title="Renombrar">
                                             <Edit2 size={14}/>
                                           </button>
                                           <button
                                               onClick={() => {
                                                   if ((data.seasons || []).length <= 1) { alert("No puedes borrar la única temporada."); return; }
                                                   setSeasonToDelete(s);
                                               }}
                                               className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                               title="Eliminar"
                                           >
                                               <Trash2 size={14}/>
                                           </button>
                                           {!s.isActive && (
                                               <button
                                                 onClick={() => setSeasonActive(s.id)}
                                                 className="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-all"
                                               >
                                                 Activar
                                               </button>
                                           )}
                                       </div>
                                   </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scoring system */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-lime-50 dark:bg-lime-900/30 rounded-lg flex items-center justify-center">
                            <Check size={15} className="text-lime-600 dark:text-lime-400"/>
                        </div>
                        <h3 className="font-black text-base text-slate-900 dark:text-white">Baremo de Puntuación</h3>
                    </div>
                    {!isGlobalView && currentSeason && (
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full uppercase tracking-wide">
                            {currentSeason.name}
                        </span>
                    )}
                </div>

                <div className="p-6">
                    {isGlobalView ? (
                        <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900">
                            <Shield size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-3"/>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Selecciona una temporada específica</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Elige una temporada en el selector de la barra lateral para editar su baremo.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* System toggle */}
                            <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex">
                                {(['NONE', 'SIMPLE', 'RANGES'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        className={`flex-1 py-2.5 text-xs font-black uppercase rounded-lg transition-all ${localSettings.scoringSystem === mode ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                        onClick={() => setLocalSettings(s => ({...s, scoringSystem: mode}))}
                                    >
                                        {mode === 'NONE' ? 'Desactivado' : mode === 'SIMPLE' ? 'Simple' : 'Tramos'}
                                    </button>
                                ))}
                            </div>

                            {localSettings.scoringSystem === 'SIMPLE' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Input type="number" label="Puntos por Victoria" value={localSettings.pointsPerWin} onChange={e => setLocalSettings(p => ({...p, pointsPerWin: Number(e.target.value)}))} />
                                    <Input type="number" label="Puntos por Empate" value={localSettings.pointsPerDraw} onChange={e => setLocalSettings(p => ({...p, pointsPerDraw: Number(e.target.value)}))} />
                                    <Input type="number" label="Puntos por Derrota" value={localSettings.pointsPerLoss} onChange={e => setLocalSettings(p => ({...p, pointsPerLoss: Number(e.target.value)}))} />
                                    <Input type="number" label="Puntos por Asistencia" value={localSettings.pointsAttendance} onChange={e => setLocalSettings(p => ({...p, pointsAttendance: Number(e.target.value)}))} />
                                </div>
                            )}

                            {localSettings.scoringSystem === 'RANGES' && (
                                <div className="space-y-4">
                                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <Select
                                            label="Cargar tramos por categoría"
                                            value={selectedCategory}
                                            onChange={(e) => {
                                                const cat = e.target.value;
                                                if (cat && PRESET_RANGES[cat]) setLocalSettings(s => ({...s, ranges: PRESET_RANGES[cat]}));
                                            }}
                                            options={[
                                                {label: 'Seleccionar categoría...', value: ''},
                                                {label: '1ª Categoría', value: '1ª'},
                                                {label: '2ª Categoría', value: '2ª'},
                                                {label: '3ª Categoría', value: '3ª'},
                                                {label: '4ª Categoría', value: '4ª'},
                                                {label: '5ª Categoría', value: '5ª'},
                                                {label: '6ª Categoría', value: '6ª'},
                                            ]}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-2 italic">Al seleccionar una categoría se reemplazarán los valores actuales.</p>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                        <table className="w-full text-xs text-center">
                                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                <tr>
                                                    <th className="p-3 font-black">Desde</th>
                                                    <th className="p-3 font-black">Hasta</th>
                                                    <th className="p-3 font-black text-lime-600 dark:text-lime-400">+ Victoria</th>
                                                    <th className="p-3 font-black text-red-500 dark:text-red-400">− Derrota</th>
                                                    <th className="p-3"/>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {(localSettings.ranges || []).map((range, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                        <td className="p-2"><input type="number" className="w-20 p-2 border-2 border-slate-200 dark:border-slate-700 rounded-lg text-center bg-white dark:bg-slate-800 dark:text-white text-xs font-medium focus:outline-none focus:border-blue-400" value={range.min} onChange={(e) => updateRange(idx, 'min', Number(e.target.value))}/></td>
                                                        <td className="p-2"><input type="number" className="w-20 p-2 border-2 border-slate-200 dark:border-slate-700 rounded-lg text-center bg-white dark:bg-slate-800 dark:text-white text-xs font-medium focus:outline-none focus:border-blue-400" value={range.max} onChange={(e) => updateRange(idx, 'max', Number(e.target.value))}/></td>
                                                        <td className="p-2"><input type="number" className="w-20 p-2 border-2 border-lime-200 dark:border-lime-800/40 rounded-lg text-center font-black text-lime-700 dark:text-lime-400 bg-lime-50 dark:bg-lime-900/20 text-xs focus:outline-none focus:border-lime-400" value={range.win} onChange={(e) => updateRange(idx, 'win', Number(e.target.value))}/></td>
                                                        <td className="p-2"><input type="number" className="w-20 p-2 border-2 border-red-200 dark:border-red-800/40 rounded-lg text-center font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 text-xs focus:outline-none focus:border-red-400" value={range.loss} onChange={(e) => updateRange(idx, 'loss', Number(e.target.value))}/></td>
                                                        <td className="p-2">
                                                            <button onClick={() => removeRange(idx)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <Button variant="secondary" onClick={addRange} className="w-full border-dashed border-2 py-3">
                                        + Añadir Tramo
                                    </Button>
                                </div>
                            )}

                            {localSettings.scoringSystem === 'NONE' && (
                                <div className="py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900">
                                    <Shield size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-3"/>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Puntuación automática desactivada</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                                        Solo se mostrarán los puntos iniciales de cada jugador.
                                    </p>
                                </div>
                            )}

                            <div className="pt-2">
                                <Button onClick={handleSave} className="w-full" size="lg">
                                    Guardar Configuración
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
};

export default SettingsView;
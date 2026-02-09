
import React, { useState, useEffect } from 'react';
import { Shield, Trash2, Check, X, Edit2 } from '../Icons';
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
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in pb-20 relative">
            
            {/* --- DELETE CONFIRMATION MODAL (Based on provided example) --- */}
            {seasonToDelete && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4 text-center animate-in fade-in">
                      <Shield className="w-12 h-12 text-red-500 mb-4" />
                      <h4 className="text-white font-black text-2xl mb-2">¿Eliminar Temporada?</h4>
                      <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
                          Vas a eliminar <strong>"{seasonToDelete.name}"</strong>.<br/>
                          Esta acción borrará todos los partidos asociados y no se puede deshacer.
                      </p>
                      <div className="flex gap-4">
                          <button 
                              onClick={() => setSeasonToDelete(null)}
                              className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold uppercase tracking-wide transition-all"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={executeDeleteSeason}
                              className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-wide flex items-center gap-2 transition-all shadow-lg shadow-red-600/30"
                          >
                              <Trash2 className="w-5 h-5" />
                              Confirmar Borrado
                          </button>
                      </div>
                  </div>
            )}

            <header className="text-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase">Ajustes del Equipo</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Gestiona temporadas y baremos.</p>
            </header>
            <Card className="space-y-4">
                 <h3 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Temporadas</h3>
                 <div className="flex gap-2">
                     <Input placeholder="Nueva temporada (ej. 2025)" value={newSeasonName} onChange={(e) => setNewSeasonName(e.target.value)} />
                     <Button onClick={addNewSeason} disabled={!newSeasonName}>Crear</Button>
                 </div>
                 <div className="space-y-3 mt-4">
                     {(data.seasons || []).map(s => (
                         <div key={s.id} className={`flex justify-between items-center p-4 rounded-xl border transition-all ${s.isActive ? 'bg-lime-50 dark:bg-lime-900/10 border-lime-200 dark:border-lime-900/50' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                             {editingSeasonId === s.id ? (
                                <div className="flex gap-2 flex-1 items-center">
                                    <input type="text" value={tempSeasonName} onChange={(e) => setTempSeasonName(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-lime-400" autoFocus/>
                                    <button onClick={saveSeasonName} className="bg-lime-500 text-white p-2 rounded-lg"><Check size={18} /></button>
                                    <button onClick={() => setEditingSeasonId(null)} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-lg"><X size={18} /></button>
                                </div>
                             ) : (
                                <div className="flex-1 flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className={`font-black text-base ${s.isActive ? 'text-blue-900 dark:text-blue-200' : 'text-slate-700 dark:text-slate-300'}`}>{s.name}</span>
                                      {s.isActive && <span className="text-[10px] font-black text-lime-600 dark:text-lime-400 uppercase">Activa</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => startEditingSeason(s)} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"><Edit2 size={16} /></button>
                                      <button 
                                          type="button" 
                                          onClick={(e) => { 
                                              e.stopPropagation(); 
                                              // Prevent deleting if it's the only season
                                              if ((data.seasons || []).length <= 1) {
                                                  alert("No puedes borrar la única temporada existente.");
                                                  return;
                                              }
                                              setSeasonToDelete(s); 
                                          }} 
                                          className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                          title="Borrar Temporada"
                                      >
                                          <Trash2 size={18} />
                                      </button>
                                      {!s.isActive && (
                                        <button onClick={() => setSeasonActive(s.id)} className="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-all">Activar</button>
                                      )}
                                    </div>
                                </div>
                             )}
                         </div>
                     ))}
                 </div>
            </Card>
            <Card className="space-y-6">
                 <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">Baremo de Puntuación {!isGlobalView && <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full uppercase">Temporada: {currentSeason?.name}</span>}</h3>
                 {isGlobalView ? ( <div className="p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900"><p className="text-slate-400 font-medium">Selecciona una temporada específica para editar sus puntos.</p></div> ) : (
                    <>
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-6">
                        <button className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${localSettings.scoringSystem === 'NONE' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`} onClick={() => setLocalSettings(s => ({...s, scoringSystem: 'NONE'}))}>Desactivado</button>
                        <button className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${localSettings.scoringSystem === 'SIMPLE' ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`} onClick={() => setLocalSettings(s => ({...s, scoringSystem: 'SIMPLE'}))}>Simple</button>
                        <button className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${localSettings.scoringSystem === 'RANGES' ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`} onClick={() => setLocalSettings(s => ({...s, scoringSystem: 'RANGES'}))}>Tramos</button>
                    </div>
                    {localSettings.scoringSystem === 'SIMPLE' ? (
                        <div className="grid grid-cols-2 gap-4">
                            <Input type="number" label="Victoria" value={localSettings.pointsPerWin} onChange={e => setLocalSettings(p => ({...p, pointsPerWin: Number(e.target.value)}))} />
                            <Input type="number" label="Empate" value={localSettings.pointsPerDraw} onChange={e => setLocalSettings(p => ({...p, pointsPerDraw: Number(e.target.value)}))} />
                            <Input type="number" label="Derrota" value={localSettings.pointsPerLoss} onChange={e => setLocalSettings(p => ({...p, pointsPerLoss: Number(e.target.value)}))} />
                            <Input type="number" label="Asistencia" value={localSettings.pointsAttendance} onChange={e => setLocalSettings(p => ({...p, pointsAttendance: Number(e.target.value)}))} />
                        </div>
                    ) : localSettings.scoringSystem === 'RANGES' ? (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <Select 
                                    label="Automatizar Tramos por Categoría"
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        const cat = e.target.value;
                                        if (cat && PRESET_RANGES[cat]) {
                                            setLocalSettings(s => ({...s, ranges: PRESET_RANGES[cat]}));
                                        }
                                    }}
                                    options={[
                                        {label: 'Seleccionar para cargar...', value: ''},
                                        {label: '1ª Categoría', value: '1ª'},
                                        {label: '2ª Categoría', value: '2ª'},
                                        {label: '3ª Categoría', value: '3ª'},
                                        {label: '4ª Categoría', value: '4ª'},
                                        {label: '5ª Categoría', value: '5ª'},
                                        {label: '6ª Categoría', value: '6ª'},
                                    ]}
                                />
                                <p className="text-[10px] text-slate-400 mt-2 italic">* Al seleccionar una categoría se reemplazarán los valores actuales de la tabla.</p>
                            </div>
                            <div className="overflow-x-auto"><table className="w-full text-xs text-center"><thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 uppercase"><tr><th className="p-2">Desde</th><th className="p-2">Hasta</th><th className="p-2 text-lime-600 dark:text-lime-400">Sumar</th><th className="p-2 text-red-500 dark:text-red-400">Restar</th><th className="p-2"></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(localSettings.ranges || []).map((range, idx) => ( <tr key={idx}><td><input type="number" className="w-16 p-2 border dark:border-slate-700 rounded-lg text-center bg-white dark:bg-slate-800 dark:text-white" value={range.min} onChange={(e) => updateRange(idx, 'min', Number(e.target.value))} /></td><td><input type="number" className="w-16 p-2 border dark:border-slate-700 rounded-lg text-center bg-white dark:bg-slate-800 dark:text-white" value={range.max} onChange={(e) => updateRange(idx, 'max', Number(e.target.value))} /></td><td><input type="number" className="w-20 p-2 border dark:border-lime-900/50 rounded-lg text-center font-black text-lime-700 dark:text-lime-400 bg-lime-50 dark:bg-lime-900/20" value={range.win} onChange={(e) => updateRange(idx, 'win', Number(e.target.value))} /></td><td><input type="number" className="w-20 p-2 border dark:border-red-900/50 rounded-lg text-center font-black text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20" value={range.loss} onChange={(e) => updateRange(idx, 'loss', Number(e.target.value))} /></td><td><button onClick={() => removeRange(idx)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></td></tr> ))}
                            </tbody></table><div className="mt-4"><Button variant="secondary" onClick={addRange} className="w-full text-xs border-dashed border-2 py-3">Añadir Nuevo Tramo</Button></div></div>
                        </div>
                    ) : (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900">
                            <Shield size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2"/>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Puntuación Automática Desactivada</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">Los partidos no sumarán ni restarán puntos. Solo se mostrarán los puntos iniciales.</p>
                        </div>
                    )}
                    <div className="pt-6 border-t border-slate-100 dark:border-slate-700"><Button onClick={handleSave} className="w-full h-14 text-base">Guardar Configuración de Temporada</Button></div>
                    </>
                 )}
            </Card>
        </div>
    )
};

export default SettingsView;
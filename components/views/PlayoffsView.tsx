import React, { useState, useMemo } from 'react';
import { Trophy, Plus, Trash2, Edit2, ChevronDown, X, Shield, Home, Plane, Users, Check, Camera, Sparkles } from '../Icons';
import { Button, ConfirmDialog } from '../UIComponents';
import { extractScheduleFromFederationImage } from '../../services/geminiService';
import { AppState, PlayoffBracket, PlayoffRound, PlayoffTie, PlayoffLeg, MatchLineup, MatchResult, PlayoffLegFormat, Player } from '../../types';
import { useToast } from '../Toast';
import { TANDA_OPTIONS } from '../../utils/constants';

const uuid = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Convention (same as App.tsx):
// Stored as "sWe-sThey" where sWe is always the left field the user sees.
// isHome=true  → left = us,   right = them  → sWe > sThey means WIN
// isHome=false → left = them, right = us    → sThey > sWe means WIN
const calcSetResult = (sWe: string, sThey: string, isHome: boolean): 'win' | 'loss' | 'draw' => {
  const l = Number(sWe), r = Number(sThey);
  if (isNaN(l) || isNaN(r) || (l === 0 && r === 0)) return 'draw';
  if (isHome) return l > r ? 'win' : l < r ? 'loss' : 'draw';
  else        return r > l ? 'win' : r < l ? 'loss' : 'draw';
};

const calcLineupResult = (l: MatchLineup, isHome: boolean): MatchResult => {
  let w = 0, lv = 0;
  for (const set of [l.set1, l.set2, l.set3].filter(Boolean) as string[]) {
    const [sWe, sThey] = set.split('-');
    const r = calcSetResult(sWe, sThey, isHome);
    if (r === 'win') w++; else if (r === 'loss') lv++;
  }
  return w > lv ? MatchResult.WIN : lv > w ? MatchResult.LOSS : MatchResult.DRAW;
};

interface LegStats { matchWins: number; matchLosses: number; setsWon: number; setsLost: number; }

const getLegStats = (leg: PlayoffLeg): LegStats => {
  let matchWins = 0, matchLosses = 0, setsWon = 0, setsLost = 0;
  for (const l of leg.lineups) {
    let pw = 0, pl = 0, hasSets = false;
    for (const set of [l.set1, l.set2, l.set3].filter(Boolean) as string[]) {
      const [sWe, sThey] = set.split('-');
      const r = calcSetResult(sWe, sThey, leg.isHome);
      if (r !== 'draw') hasSets = true;
      if (r === 'win') { pw++; setsWon++; } else if (r === 'loss') { pl++; setsLost++; }
    }
    if (hasSets) { if (pw > pl) matchWins++; else if (pl > pw) matchLosses++; }
  }
  return { matchWins, matchLosses, setsWon, setsLost };
};

const resolveTie = (tie: PlayoffTie): 'home' | 'away' | 'pending' => {
  const done = tie.legs.filter(l => l.lineups.some(lu => lu.set1));
  if (done.length === 0) return 'pending';
  if (tie.legFormat === 'HOME_AWAY' && done.length < 2) return 'pending';

  // matchWins/matchLosses from getLegStats are always OUR wins/losses
  // Map to home/away based on who "we" are in the tie
  let ourWins = 0, ourLosses = 0, ourSets = 0, theirSets = 0;
  for (const leg of done) {
    const s = getLegStats(leg);
    ourWins += s.matchWins;
    ourLosses += s.matchLosses;
    ourSets += s.setsWon;
    theirSets += s.setsLost;
  }

  // Determine if we are home or away in this tie
  // (homeTeam is set when the tie is created based on weAreHome)
  const weAreHomeTie = done[0] && tie.legs.some(l => l.isHome);
  // Use first leg's isHome to determine our role in the tie
  const weAreHome = tie.legs[0]?.isHome ?? true;
  const homePW = weAreHome ? ourWins : ourLosses;
  const awayPW = weAreHome ? ourLosses : ourWins;
  const homeSets = weAreHome ? ourSets : theirSets;
  const awaySets = weAreHome ? theirSets : ourSets;

  if (homePW > awayPW) return 'home';
  if (awayPW > homePW) return 'away';
  if (homeSets > awaySets) return 'home';
  if (awaySets > homeSets) return 'away';
  if (tie.seedHome != null && tie.seedAway != null) return tie.seedHome < tie.seedAway ? 'home' : 'away';
  return 'pending';
};

const getTieAggregate = (tie: PlayoffTie) => {
  // matchWins/setsWon are always OUR wins — map to home/away via first leg
  let ourWins = 0, ourLosses = 0, ourSets = 0, theirSets = 0;
  for (const leg of tie.legs) {
    const s = getLegStats(leg);
    ourWins += s.matchWins;
    ourLosses += s.matchLosses;
    ourSets += s.setsWon;
    theirSets += s.setsLost;
  }
  const weAreHome = tie.legs[0]?.isHome ?? true;
  return {
    home: { wins: weAreHome ? ourWins : ourLosses, sets: weAreHome ? ourSets : theirSets },
    away: { wins: weAreHome ? ourLosses : ourWins, sets: weAreHome ? theirSets : ourSets },
  };
};

const emptyLeg = (isHome: boolean, gender?: 'MASCULINO' | 'FEMENINO'): PlayoffLeg => ({ id: uuid(), isHome, lineups: [], tandas: gender === 'FEMENINO' ? '4' : '5', date: '', notes: '' });

// ─── LEG EDITOR MODAL ────────────────────────────────────────────────────────

interface LegEditorModalProps {
  leg: PlayoffLeg;
  players: Player[];
  gender?: 'MASCULINO' | 'FEMENINO';
  onSave: (leg: PlayoffLeg) => void;
  onClose: () => void;
}

interface LineupForm {
  pairNumber: string;
  player1Id: string;
  player2Id: string;
  opponent1Name: string;
  opponent2Name: string;
  s1We: string; s1They: string;
  s2We: string; s2They: string;
  s3We: string; s3They: string;
}

const emptyForm = (): LineupForm => ({
  pairNumber: '', player1Id: '', player2Id: '',
  opponent1Name: '', opponent2Name: '',
  s1We: '', s1They: '', s2We: '', s2They: '', s3We: '', s3They: '',
});

const LegEditorModal: React.FC<LegEditorModalProps> = ({ leg, players, gender, onSave, onClose }) => {
  const [editedLeg, setEditedLeg] = useState<PlayoffLeg>(leg);
  const [form, setForm] = useState<LineupForm>(emptyForm());
  const [activeSection, setActiveSection] = useState<'setup' | 'lineups'>('setup');
  const [isProcessingFed, setIsProcessingFed] = useState(false);
  const { error: toastError } = useToast();

  const handleFederationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      setIsProcessingFed(true);
      try {
        const matches = await extractScheduleFromFederationImage(base64, players);
        if (matches.length > 0) {
          const match = matches[0];
          const findId = (name: string): string => {
            if (!name) return '';
            const normalized = name.toLowerCase().trim();
            const found = players.find(p => {
              const fullName = `${p.name} ${(p as any).surname || ''}`.toLowerCase().trim();
              const firstName = p.name.toLowerCase();
              return fullName === normalized ||
                firstName === normalized ||
                normalized.includes(firstName) ||
                fullName.includes(normalized);
            });
            return found?.id || '';
          };
          const resolvedLineups = (match.lineups || []).map((l: any, idx: number) => {
            const p1Id = l.player1Id || findId(l.player1Name || '');
            const p2Id = l.player2Id || findId(l.player2Name || '');
            const newLineup: MatchLineup = {
              player1Id: p1Id,
              player2Id: p2Id,
              opponent1Name: l.opponent1Name || undefined,
              opponent2Name: l.opponent2Name || undefined,
              set1: l.set1 || '',
              set2: l.set2 || '',
              set3: l.set3 || undefined,
              result: MatchResult.DRAW,
              pairNumber: l.pairNumber || (idx + 1),
            };
            newLineup.result = calcLineupResult(newLineup, editedLeg.isHome);
            return newLineup;
          });
          const matchedPlayerIds = resolvedLineups
            .flatMap((l: MatchLineup) => [l.player1Id, l.player2Id])
            .filter(Boolean) as string[];
          const mergedAvailable = Array.from(new Set([
            ...(editedLeg.availablePlayers || []),
            ...matchedPlayerIds
          ]));
          setEditedLeg(prev => ({
            ...prev,
            date: match.date || prev.date,
            tandas: match.tandas || prev.tandas,
            notes: match.notes || prev.notes,
            lineups: resolvedLineups.length > 0 ? resolvedLineups : prev.lineups,
            availablePlayers: mergedAvailable,
          }));
          setActiveSection('lineups');
        }
      } catch (err: any) {
        console.error('Error procesando el acta:', err?.message || err);
        toastError('Error al procesar el acta: ' + (err?.message || 'inténtalo de nuevo'));
      } finally {
        setIsProcessingFed(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const filteredTandaOptions = TANDA_OPTIONS.filter(o => {
    const isMasc = o.label.includes('Masculino');
    if (gender === 'FEMENINO') return !isMasc;
    return isMasc; // MASCULINO or default
  });

  const availIds = editedLeg.availablePlayers || [];
  const allSorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const availPlayers = availIds.length > 0 ? allSorted.filter(p => availIds.includes(p.id)) : allSorted;
  const playerOpts = [{ value: '', label: '— Seleccionar —' }, ...availPlayers.map(p => ({ value: p.id, label: p.name }))];

  const addLineup = () => {
    const { pairNumber, player1Id, player2Id, opponent1Name, opponent2Name, s1We, s1They, s2We, s2They, s3We, s3They } = form;
    if (!s1We || !s1They) return;
    const newLineup: MatchLineup = {
      player1Id, player2Id,
      opponent1Name: opponent1Name || undefined,
      opponent2Name: opponent2Name || undefined,
      set1: `${s1We}-${s1They}`,
      set2: s2We && s2They ? `${s2We}-${s2They}` : '',
      result: MatchResult.DRAW,
      pairNumber: pairNumber ? Number(pairNumber) : undefined,
    };
    if (s3We && s3They) newLineup.set3 = `${s3We}-${s3They}`;
    newLineup.result = calcLineupResult(newLineup, editedLeg.isHome);
    const newAvail = [...availIds];
    if (player1Id && !newAvail.includes(player1Id)) newAvail.push(player1Id);
    if (player2Id && !newAvail.includes(player2Id)) newAvail.push(player2Id);
    setEditedLeg(prev => {
      const newLineups = editingLineupIdx !== null
        ? prev.lineups.map((l, i) => i === editingLineupIdx ? newLineup : l)
        : [...prev.lineups, newLineup];
      return { ...prev, lineups: newLineups, availablePlayers: newAvail };
    });
    setEditingLineupIdx(null);
    setForm(emptyForm());
  };

  const removeLineup = (idx: number) => setEditedLeg(prev => ({ ...prev, lineups: prev.lineups.filter((_, i) => i !== idx) }));

  const [editingLineupIdx, setEditingLineupIdx] = useState<number | null>(null);

  const editLineup = (idx: number) => {
    const l = editedLeg.lineups[idx];
    const [s1We, s1They] = (l.set1 || '-').split('-');
    const [s2We, s2They] = (l.set2 || '-').split('-');
    const [s3We, s3They] = l.set3 ? l.set3.split('-') : ['', ''];
    setForm({ pairNumber: String(l.pairNumber || ''), player1Id: l.player1Id, player2Id: l.player2Id, opponent1Name: l.opponent1Name || '', opponent2Name: l.opponent2Name || '', s1We: s1We || '', s1They: s1They || '', s2We: s2We || '', s2They: s2They || '', s3We: s3We || '', s3They: s3They || '' });
    setEditingLineupIdx(idx);
    setActiveSection('lineups');
  };

  const cancelEditLineup = () => {
    setEditingLineupIdx(null);
    setForm(emptyForm());
  };

  const toggleAvail = (id: string) => {
    const cur = editedLeg.availablePlayers || [];
    setEditedLeg(prev => ({ ...prev, availablePlayers: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] }));
  };

  const leftLabel = editedLeg.isHome ? 'Nos' : 'Ellos';
  const rightLabel = editedLeg.isHome ? 'Ellos' : 'Nos';
  const canAddLineup = !!(form.s1We && form.s1They);
  const legStats = getLegStats(editedLeg);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] overflow-y-auto flex flex-col items-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 my-auto">

        {/* ── Header ── */}
        <div className="shrink-0 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 z-10 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl ${editedLeg.isHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                  {editedLeg.isHome ? <Home size={12}/> : <Plane size={12}/>}
                  {editedLeg.isHome ? 'Partido en casa' : 'Partido fuera'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {editedLeg.isHome
                  ? 'Columna izquierda = vuestros games'
                  : 'Columna izquierda = games del rival'}
              </p>
            </div>
            <button onClick={onClose} className="shrink-0 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all"><X size={18}/></button>
          </div>

          {/* Section tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { key: 'setup', label: '⚙️ Configuración' },
              { key: 'lineups', label: `🎾 Parejas${editedLeg.lineups.length > 0 ? ` (${editedLeg.lineups.length})` : ''}` },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setActiveSection(key as any)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${activeSection === key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1">

          {/* SETUP TAB */}
          {activeSection === 'setup' && (
            <div className="p-6 space-y-5">
              {/* Date & Tandas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Fecha y hora</label>
                  <input type="datetime-local" value={editedLeg.date || ''}
                    onChange={e => setEditedLeg(p => ({ ...p, date: e.target.value }))}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Formato de tandas</label>
                  <select value={editedLeg.tandas || '5'}
                    onChange={e => setEditedLeg(p => ({ ...p, tandas: e.target.value }))}
                    className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none">
                    {filteredTandaOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Availability */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">Disponibilidad</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {availIds.length === 0 ? 'Selecciona quién juega este partido' : `${availIds.length} jugador${availIds.length !== 1 ? 'es' : ''} disponible${availIds.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEditedLeg(p => ({ ...p, availablePlayers: allSorted.map(pl => pl.id) }))}
                      className="text-xs font-bold text-blue-500 hover:text-blue-600 underline">Todos</button>
                    <button onClick={() => setEditedLeg(p => ({ ...p, availablePlayers: [] }))}
                      className="text-xs font-bold text-slate-400 hover:text-red-500 underline">Ninguno</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allSorted.map(p => {
                    const sel = availIds.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => toggleAvail(p.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left ${sel ? 'bg-lime-50 dark:bg-lime-900/20 border-lime-400 dark:border-lime-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                        <div className={`w-3 h-3 rounded-sm shrink-0 border flex items-center justify-center ${sel ? 'bg-lime-500 border-lime-500' : 'border-slate-300 dark:border-slate-600 opacity-50'}`}>
                          {sel && <div className="w-1.5 h-1.5 rounded-sm bg-white"/>}
                        </div>
                        <span className={`text-xs font-bold truncate ${sel ? 'text-slate-800 dark:text-lime-100' : 'text-slate-400 dark:text-slate-500'}`}>{p.name.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={() => setActiveSection('lineups')}
                className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm transition-all hover:bg-slate-700 dark:hover:bg-slate-100 flex items-center justify-center gap-2">
                Continuar → Añadir resultados
              </button>
            </div>
          )}

          {/* LINEUPS TAB */}
          {activeSection === 'lineups' && (
            <div className="p-6 space-y-5">

              {/* Importar desde Federación */}
              <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed font-black text-sm transition-all cursor-pointer
                ${isProcessingFed
                  ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-400 opacity-70 cursor-not-allowed'
                  : 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-400'}`}>
                {isProcessingFed
                  ? <><Sparkles size={15} className="animate-pulse" /> Procesando acta...</>
                  : <><Camera size={15} /> Importar desde Federación</>}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  disabled={isProcessingFed}
                  onChange={handleFederationImageUpload}
                />
              </label>

              {/* Summary of entered lineups */}
              {editedLeg.lineups.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">
                      Parejas introducidas
                    </h4>
                    <span className={`text-sm font-black ${legStats.matchWins > legStats.matchLosses ? 'text-lime-500' : legStats.matchLosses > legStats.matchWins ? 'text-red-500' : 'text-blue-400'}`}>
                      {legStats.matchWins}–{legStats.matchLosses}
                    </span>
                  </div>
                  {editedLeg.lineups
                    .map((l, originalIdx) => ({ l, originalIdx }))
                    .sort((a, b) => (a.l.pairNumber ?? 99) - (b.l.pairNumber ?? 99))
                    .map(({ l, originalIdx }) => {
                    const res = calcLineupResult(l, editedLeg.isHome);
                    const isW = res === MatchResult.WIN, isL = res === MatchResult.LOSS;
                    const p1 = players.find(p => p.id === l.player1Id);
                    const p2 = players.find(p => p.id === l.player2Id);
                    const setsStr = [l.set1, l.set2, l.set3].filter(Boolean).join('  ');
                    const isBeingEdited = editingLineupIdx === originalIdx;
                    return (
                      <div key={originalIdx} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${isBeingEdited ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600 ring-1 ring-blue-400/30' : isW ? 'bg-lime-50 dark:bg-lime-900/10 border-lime-300 dark:border-lime-800' : isL ? 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 ${isBeingEdited ? 'bg-blue-500' : isW ? 'bg-lime-500' : isL ? 'bg-red-500' : 'bg-slate-400'}`}>
                          {isBeingEdited ? '✎' : (l.pairNumber ?? originalIdx + 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black text-slate-800 dark:text-white truncate">
                            {p1?.name || '?'} / {p2?.name || '?'}
                          </div>
                          {(l.opponent1Name || l.opponent2Name) && (
                            <div className="text-xs text-slate-400 truncate">vs {l.opponent1Name || '?'} / {l.opponent2Name || '?'}</div>
                          )}
                        </div>
                        <div className={`font-mono font-black text-sm px-2.5 py-1 rounded-xl ${isBeingEdited ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : isW ? 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300' : isL ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                          {setsStr}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => editLineup(originalIdx)} className={`p-2 rounded-lg transition-all ${isBeingEdited ? 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}><Edit2 size={14}/></button>
                          <button onClick={() => { if (!isBeingEdited) removeLineup(originalIdx); }} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-30" disabled={isBeingEdited}><Trash2 size={14}/></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add lineup form */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {form.pairNumber ? `Editando Pareja ${form.pairNumber}` : 'Nueva pareja'}
                </h4>

                {/* Pair number + players */}
                <div className="flex gap-2 items-end">
                  <div className="w-12 shrink-0">
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Nº</label>
                    <input type="number" min={1} max={9} value={form.pairNumber}
                      onChange={e => setForm(f => ({ ...f, pairNumber: e.target.value }))}
                      className="w-full text-sm font-black text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 outline-none focus:ring-2 focus:ring-lime-400 text-slate-800 dark:text-white"/>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Jugador Revés</label>
                      <select value={form.player1Id} onChange={e => setForm(f => ({ ...f, player1Id: e.target.value }))}
                        className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-lime-400">
                        {playerOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Jugador Drive</label>
                      <select value={form.player2Id} onChange={e => setForm(f => ({ ...f, player2Id: e.target.value }))}
                        className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-lime-400">
                        {playerOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Rival names */}
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Rival Revés (opcional)" value={form.opponent1Name}
                    onChange={e => setForm(f => ({ ...f, opponent1Name: e.target.value }))}
                    className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 placeholder-slate-300 outline-none focus:ring-2 focus:ring-lime-400 text-slate-700 dark:text-slate-200"/>
                  <input type="text" placeholder="Rival Drive (opcional)" value={form.opponent2Name}
                    onChange={e => setForm(f => ({ ...f, opponent2Name: e.target.value }))}
                    className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 placeholder-slate-300 outline-none focus:ring-2 focus:ring-lime-400 text-slate-700 dark:text-slate-200"/>
                </div>

                {/* Sets */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Set 1 *', we: 's1We', they: 's1They', required: true },
                    { label: 'Set 2', we: 's2We', they: 's2They', required: false },
                    { label: 'Set 3', we: 's3We', they: 's3They', required: false },
                  ].map(({ label, we, they, required }) => {
                    const weVal = (form as any)[we] as string;
                    const theyVal = (form as any)[they] as string;
                    const res = weVal && theyVal ? calcSetResult(weVal, theyVal, editedLeg.isHome) : null;
                    return (
                      <div key={label}>
                        <div className="text-center text-[9px] font-black text-slate-400 uppercase mb-1">{label}</div>
                        <div className={`rounded-xl border overflow-hidden ${res === 'win' ? 'border-lime-400' : res === 'loss' ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}>
                          <div className={`flex items-stretch ${res === 'win' ? 'bg-lime-50 dark:bg-lime-900/10' : res === 'loss' ? 'bg-red-50 dark:bg-red-900/10' : 'bg-white dark:bg-slate-900'}`}>
                            <div className="flex-1 flex flex-col items-center border-r border-slate-200 dark:border-slate-700">
                              <span className={`text-[8px] font-black uppercase pt-1 pb-0.5 ${editedLeg.isHome ? 'text-blue-400' : 'text-orange-400'}`}>{leftLabel}</span>
                              <input type="number" min={0} max={99} value={weVal}
                                onChange={e => setForm(f => ({ ...f, [we]: e.target.value }))}
                                className="w-full pb-1 text-center text-lg font-black bg-transparent outline-none text-slate-800 dark:text-white"/>
                            </div>
                            <div className="flex-1 flex flex-col items-center">
                              <span className={`text-[8px] font-black uppercase pt-1 pb-0.5 ${editedLeg.isHome ? 'text-orange-400' : 'text-blue-400'}`}>{rightLabel}</span>
                              <input type="number" min={0} max={99} value={theyVal}
                                onChange={e => setForm(f => ({ ...f, [they]: e.target.value }))}
                                className="w-full pb-1 text-center text-lg font-black bg-transparent outline-none text-slate-800 dark:text-white"/>
                            </div>
                          </div>
                          {res && (
                            <div className={`text-center text-[8px] font-black py-0.5 ${res === 'win' ? 'bg-lime-500 text-white' : res === 'loss' ? 'bg-red-500 text-white' : 'bg-blue-400 text-white'}`}>
                              {res === 'win' ? '✓ Win' : res === 'loss' ? '✗ Loss' : '~ Tie'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  {editingLineupIdx !== null && (
                    <button onClick={cancelEditLineup}
                      className="flex-none px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-black text-sm transition-all flex items-center gap-2">
                      <X size={15}/> Cancelar
                    </button>
                  )}
                  <button onClick={addLineup} disabled={!canAddLineup}
                    className={`flex-1 py-3 rounded-xl text-white font-black text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm ${editingLineupIdx !== null ? 'bg-lime-600 hover:bg-lime-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                    {editingLineupIdx !== null ? <><Check size={16}/> Guardar cambios</> : <><Plus size={16}/> Añadir pareja</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-6 py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm text-slate-400">
              {editedLeg.lineups.length > 0 ? (
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  {editedLeg.lineups.length} pareja{editedLeg.lineups.length !== 1 ? 's' : ''} ·{' '}
                  <span className="text-lime-600 dark:text-lime-400">{legStats.matchWins}V</span>{' '}
                  <span className="text-red-500">{legStats.matchLosses}D</span>
                </span>
              ) : (
                <span className="italic">Sin parejas todavía</span>
              )}
            </div>
            <button onClick={() => onSave(editedLeg)}
              className="px-8 py-3.5 rounded-2xl bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-sm transition-all shadow-lg shadow-lime-400/20">
              Guardar partido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── TIE CARD ────────────────────────────────────────────────────────────────

interface TieCardProps {
  tie: PlayoffTie;
  ourTeamName: string;
  players: Player[];
  gender?: 'MASCULINO' | 'FEMENINO';
  sessionRole: 'CAPTAIN' | 'GUEST';
  onUpdate: (tie: PlayoffTie) => void;
  onDelete: () => void;
}

const TieCard: React.FC<TieCardProps> = ({ tie, ourTeamName, players, gender, sessionRole, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [editingLegIdx, setEditingLegIdx] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const winner = resolveTie(tie);
  const agg = getTieAggregate(tie);
  const weAreHome = tie.homeTeam === ourTeamName;
  const ourAgg = weAreHome ? agg.home : agg.away;
  const theirAgg = weAreHome ? agg.away : agg.home;
  const opponent = weAreHome ? tie.awayTeam : tie.homeTeam;
  const isComplete = tie.legs.some(l => l.lineups.some(lu => lu.set1)) && (tie.legFormat === 'SINGLE' || tie.legs.length >= 2 && tie.legs.every(l => l.lineups.some(lu => lu.set1)));
  const weWon = winner === (weAreHome ? 'home' : 'away');
  const weLose = winner !== 'pending' && !weWon;

  const saveLeg = (idx: number, leg: PlayoffLeg) => {
    onUpdate({ ...tie, legs: tie.legs.map((l, i) => i === idx ? leg : l) });
    setEditingLegIdx(null);
  };

  const borderClass = isComplete
    ? weWon ? 'border-lime-400' : weLose ? 'border-red-400' : 'border-blue-400'
    : 'border-slate-200 dark:border-slate-700';

  return (
    <>
      <ConfirmDialog isOpen={confirmDelete} title="¿Eliminar enfrentamiento?" message={<>Se eliminará <strong>{tie.homeTeam} vs {tie.awayTeam}</strong> y todos sus resultados.</>} confirmLabel="Eliminar" onConfirm={() => { setConfirmDelete(false); onDelete(); }} onCancel={() => setConfirmDelete(false)}/>
      {editingLegIdx !== null && (
        <LegEditorModal leg={tie.legs[editingLegIdx]} players={players} gender={gender} onSave={leg => saveLeg(editingLegIdx, leg)} onClose={() => setEditingLegIdx(null)}/>
      )}

      <div className={`rounded-2xl border-2 ${borderClass} bg-white dark:bg-slate-900 shadow-sm overflow-hidden`}>
        {/* Header */}
        <div className="p-4 cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg ${weAreHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                {weAreHome ? <Home size={10}/> : <Plane size={10}/>}{weAreHome ? 'Casa' : 'Fuera'}
              </span>
              <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                {tie.legFormat === 'HOME_AWAY' ? 'Ida y vuelta' : 'Solo ida'}
              </span>
            </div>
            {isComplete ? (
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg text-white ${weWon ? 'bg-lime-500' : weLose ? 'bg-red-500' : 'bg-blue-500'}`}>
                {weWon ? '🏆 Clasificados' : weLose ? '❌ Eliminados' : '⚖️ Empate'}
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400">⏳ Pendiente</span>
            )}
          </div>

          {/* Score */}
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1"><Shield size={9}/> Nosotros</div>
              <div className="font-black text-sm text-slate-900 dark:text-white truncate">{ourTeamName}</div>
              {isComplete && <div className={`text-3xl font-black leading-none mt-1 ${weWon ? 'text-lime-500' : weLose ? 'text-red-500' : 'text-blue-400'}`}>{ourAgg.wins}</div>}
            </div>
            <div className="flex flex-col items-center justify-center px-1 shrink-0">
              {isComplete ? (
                <>
                  <div className="text-lg font-black text-slate-300 dark:text-slate-600">–</div>
                  <div className="text-[9px] text-slate-400 font-bold whitespace-nowrap">{ourAgg.sets}–{theirAgg.sets} sets</div>
                </>
              ) : (
                <div className="text-sm font-black text-slate-300 dark:text-slate-600">vs</div>
              )}
            </div>
            <div className="flex-1 min-w-0 text-right">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1 justify-end">Rival <Users size={9}/></div>
              <div className="font-black text-sm text-slate-600 dark:text-slate-300 truncate">{opponent}</div>
              {isComplete && <div className={`text-3xl font-black leading-none mt-1 ${weLose ? 'text-red-500' : 'text-slate-400'}`}>{theirAgg.wins}</div>}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold">{tie.legs.length} partido{tie.legs.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-1.5">
              {sessionRole === 'CAPTAIN' && (
                <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }} className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"><Trash2 size={13}/></button>
              )}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}><ChevronDown size={13}/></div>
            </div>
          </div>
        </div>

        {/* Expanded legs */}
        {expanded && (
          <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3 animate-in slide-in-from-top-1 duration-150">
            {tie.legs.map((leg, legIdx) => {
              const s = getLegStats(leg);
              const hasData = leg.lineups.some(l => l.set1);
              const legWon = s.matchWins > s.matchLosses;
              const legLost = s.matchLosses > s.matchWins;
              return (
                <div key={leg.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {/* Leg header */}
                  <div className={`flex items-center justify-between px-3 py-2.5 border-b border-slate-100 dark:border-slate-700 ${hasData ? legWon ? 'bg-lime-50 dark:bg-lime-900/20' : legLost ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg flex items-center gap-1 ${leg.isHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                        {leg.isHome ? <Home size={9}/> : <Plane size={9}/>}
                        {tie.legFormat === 'HOME_AWAY' ? (legIdx === 0 ? 'Ida' : 'Vuelta') : 'Partido único'}
                      </span>
                      {leg.date && <span className="text-[10px] text-slate-400 font-bold">{new Date(leg.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>}
                      {hasData && (
                        <span className={`text-xs font-black ${legWon ? 'text-lime-600 dark:text-lime-400' : legLost ? 'text-red-500' : 'text-blue-500'}`}>
                          {s.matchWins}–{s.matchLosses} <span className="font-normal text-slate-400 text-[10px]">({s.setsWon}–{s.setsLost} sets)</span>
                        </span>
                      )}
                    </div>
                    {sessionRole === 'CAPTAIN' && (
                      <button onClick={() => setEditingLegIdx(legIdx)} className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 flex items-center gap-1 shrink-0">
                        <Edit2 size={11}/> {hasData ? 'Editar' : 'Añadir'}
                      </button>
                    )}
                  </div>

                  {/* Lineup rows */}
                  {hasData ? (
                    <div className="p-3 space-y-1.5 bg-white dark:bg-slate-900">
                      {[...leg.lineups].sort((a, b) => (a.pairNumber ?? 99) - (b.pairNumber ?? 99)).map((l, i) => {
                        const res = calcLineupResult(l, leg.isHome);
                        const isW = res === MatchResult.WIN, isL = res === MatchResult.LOSS;
                        const p1 = players.find(p => p.id === l.player1Id);
                        const p2 = players.find(p => p.id === l.player2Id);
                        const setsStr = [l.set1, l.set2, l.set3].filter(Boolean).join(' ');
                        return (
                          <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isW ? 'bg-lime-50 dark:bg-lime-900/20' : isL ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 ${isW ? 'bg-lime-500' : isL ? 'bg-red-500' : 'bg-slate-400'}`}>{l.pairNumber ?? i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-700 dark:text-slate-200 text-[11px] truncate">{(p1 || p2) ? `${p1?.name || '?'} / ${p2?.name || '?'}` : `Pareja ${l.pairNumber ?? i + 1}`}</div>
                              {(l.opponent1Name || l.opponent2Name) && <div className="text-[10px] text-slate-400 truncate">vs {l.opponent1Name || '?'} / {l.opponent2Name || '?'}</div>}
                            </div>
                            <div className={`font-mono font-black text-xs px-2 py-1 rounded-lg ${isW ? 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300' : isL ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{setsStr}</div>
                            <span className={`font-black text-sm ${isW ? 'text-lime-500' : isL ? 'text-red-500' : 'text-blue-400'}`}>{isW ? '✓' : isL ? '✗' : '~'}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-center bg-white dark:bg-slate-900">
                      <p className="text-xs text-slate-400 italic">Sin resultados todavía</p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add second leg button */}
            {sessionRole === 'CAPTAIN' && tie.legFormat === 'HOME_AWAY' && tie.legs.length < 2 && (
              <button onClick={() => onUpdate({ ...tie, legs: [...tie.legs, emptyLeg(!tie.legs[0]?.isHome, gender)] })} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:border-lime-400 hover:text-lime-600 dark:hover:text-lime-400 transition-all flex items-center justify-center gap-2">
                <Plus size={14}/> Añadir partido de vuelta
              </button>
            )}

            {/* Result summary */}
            {isComplete && (
              <div className={`rounded-2xl p-4 flex items-start gap-3 border-2 ${weWon ? 'bg-lime-50 dark:bg-lime-900/10 border-lime-200 dark:border-lime-800/40' : weLose ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base ${weWon ? 'bg-lime-500' : weLose ? 'bg-red-500' : 'bg-blue-500'}`}>{weWon ? '🏆' : weLose ? '❌' : '⚖️'}</div>
                <div>
                  <p className={`font-black text-sm ${weWon ? 'text-lime-700 dark:text-lime-400' : weLose ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {weWon ? '¡Clasificados para la siguiente ronda!' : weLose ? 'Eliminados del torneo' : 'Empate técnico'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Global: <strong>{ourAgg.wins}</strong> – <strong>{theirAgg.wins}</strong> partidos · {ourAgg.sets}–{theirAgg.sets} sets</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

// ─── ADD TIE MODAL ────────────────────────────────────────────────────────────

const AddTieModal: React.FC<{ ourTeamName: string; gender?: 'MASCULINO' | 'FEMENINO'; onAdd: (tie: PlayoffTie) => void; onClose: () => void }> = ({ ourTeamName, gender, onAdd, onClose }) => {
  const [opponent, setOpponent] = useState('');
  const [weAreHome, setWeAreHome] = useState(true);
  const [legFormat, setLegFormat] = useState<PlayoffLegFormat>('SINGLE');
  const [seedUs, setSeedUs] = useState('');
  const [seedThem, setSeedThem] = useState('');
  // 'us' | 'them' | null — who wins the tiebreak when seeds are equal
  const [tiebreakFavor, setTiebreakFavor] = useState<'us' | 'them' | null>(null);

  const seedsEqual = seedUs !== '' && seedThem !== '' && parseInt(seedUs) === parseInt(seedThem);

  const handleAdd = () => {
    if (!opponent.trim()) return;
    const homeTeam = weAreHome ? ourTeamName : opponent.trim();
    const awayTeam = weAreHome ? opponent.trim() : ourTeamName;

    let finalSeedHome: number | undefined = seedUs ? parseInt(seedUs) : undefined;
    let finalSeedAway: number | undefined = seedThem ? parseInt(seedThem) : undefined;

    // When seeds are equal, apply a 0.5 advantage to the tiebreak winner
    if (seedsEqual && tiebreakFavor !== null && finalSeedHome != null && finalSeedAway != null) {
      const usIsHome = weAreHome;
      if (tiebreakFavor === 'us') {
        // We win tiebreak → our seed becomes slightly lower (better)
        if (usIsHome) finalSeedHome = finalSeedHome - 0.5;
        else finalSeedAway = finalSeedAway - 0.5;
      } else {
        // They win tiebreak → their seed becomes slightly lower (better)
        if (usIsHome) finalSeedAway = finalSeedAway - 0.5;
        else finalSeedHome = finalSeedHome - 0.5;
      }
    }

    onAdd({ id: uuid(), roundId: '', homeTeam, awayTeam, seedHome: finalSeedHome, seedAway: finalSeedAway, legFormat, legs: [emptyLeg(weAreHome, gender)] });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex flex-col items-center justify-end sm:justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-y-auto max-h-[95dvh] sm:max-h-[90vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 mt-auto sm:mt-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md"><Trophy size={18} className="text-white"/></div>
          <h3 className="font-black text-xl text-slate-900 dark:text-white">Nuevo enfrentamiento</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Equipo rival</label>
            <input type="text" placeholder="Nombre del equipo rival" value={opponent} onChange={e => setOpponent(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} autoFocus className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"/>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Primer partido</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ val: true, icon: '🏠', label: 'En casa' }, { val: false, icon: '✈️', label: 'Fuera' }].map(({ val, icon, label }) => (
                <button key={String(val)} onClick={() => setWeAreHome(val)} className={`py-3 rounded-xl text-sm font-black border-2 transition-all ${weAreHome === val ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>{icon} {label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Formato</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ val: 'SINGLE' as PlayoffLegFormat, label: 'Solo Ida' }, { val: 'HOME_AWAY' as PlayoffLegFormat, label: 'Ida y Vuelta' }].map(({ val, label }) => (
                <button key={val} onClick={() => setLegFormat(val)} className={`py-2.5 rounded-xl text-xs font-black border-2 transition-all ${legFormat === val ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Nuestra pos.</label><input type="number" min={1} placeholder="Ej: 3" value={seedUs} onChange={e => { setSeedUs(e.target.value); setTiebreakFavor(null); }} className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"/></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Pos. rival</label><input type="number" min={1} placeholder="Ej: 5" value={seedThem} onChange={e => { setSeedThem(e.target.value); setTiebreakFavor(null); }} className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"/></div>
          </div>

          {/* Tiebreak selector — only shown when both seeds are equal */}
          {seedsEqual && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
              <div>
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">⚖️ Posiciones iguales — Desempate</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">¿Qué equipo tiene mejores resultados generales?</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTiebreakFavor('us')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black border-2 transition-all text-left truncate ${tiebreakFavor === 'us' ? 'bg-lime-500 text-white border-lime-500 shadow-md shadow-lime-500/20' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-lime-400'}`}
                >
                  ✓ {ourTeamName}
                </button>
                <button
                  onClick={() => setTiebreakFavor('them')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black border-2 transition-all text-left truncate ${tiebreakFavor === 'them' ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-400'}`}
                >
                  ✓ {opponent.trim() || 'Rival'}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 transition-all">Cancelar</button>
          <button onClick={handleAdd} disabled={!opponent.trim()} className="flex-1 py-3.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-sm transition-all shadow-lg shadow-lime-400/30 disabled:opacity-50 disabled:cursor-not-allowed">Añadir</button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────

interface PlayoffsViewProps {
  data: AppState | null;
  teamId: string | null;
  viewSeasonId: string;
  sessionRole: 'CAPTAIN' | 'GUEST';
  updateTeamData: (id: string, data: Partial<AppState>) => Promise<void>;
}

const PlayoffsView: React.FC<PlayoffsViewProps> = ({ data, teamId, viewSeasonId, sessionRole, updateTeamData }) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null);
  const [showNewBracket, setShowNewBracket] = useState(false);
  const [newBracketName, setNewBracketName] = useState('');
  const [newRoundName, setNewRoundName] = useState('');
  const [newRoundFormat, setNewRoundFormat] = useState<PlayoffLegFormat>('SINGLE');
  const [addTieRoundId, setAddTieRoundId] = useState<string | null>(null);
  const [confirmDeleteRound, setConfirmDeleteRound] = useState<string | null>(null);
  const [confirmDeleteBracket, setConfirmDeleteBracket] = useState<string | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<string[]>([]);

  const playoffs = useMemo(() => data?.playoffs || [], [data]);
  const players = useMemo(() => data?.players || [], [data]);
  const ourTeamName = data?.teamName || 'Nuestro Equipo';
  // Resolve gender: default to MASCULINO if not set
  const resolvedGender = useMemo(() => {
    if (data?.settings?.gender) return data.settings.gender;
    const activeSeason = viewSeasonId !== 'all'
      ? data?.seasons?.find(s => s.id === viewSeasonId)
      : data?.seasons?.find(s => s.isActive);
    return activeSeason?.settings?.gender ?? 'MASCULINO';
  }, [data, viewSeasonId]);

  const currentSeasonName = useMemo(() => viewSeasonId === 'all' ? 'Todas las temporadas' : data?.seasons?.find(s => s.id === viewSeasonId)?.name || viewSeasonId, [data, viewSeasonId]);
  const visibleBrackets = useMemo(() => viewSeasonId === 'all' ? playoffs : playoffs.filter(b => b.seasonId === viewSeasonId), [playoffs, viewSeasonId]);
  const selectedBracket = useMemo(() => visibleBrackets.find(b => b.id === selectedBracketId) ?? visibleBrackets[0] ?? null, [visibleBrackets, selectedBracketId]);

  const save = async (updated: PlayoffBracket[]) => {
    if (!teamId) return;
    try { 
      // Firestore does not allow undefined values, we strip them by serializing.
      const cleanData = JSON.parse(JSON.stringify(updated));
      await updateTeamData(teamId, { playoffs: cleanData }); 
    }
    catch (e: any) { toastError('Error al guardar: ' + (e.message || '')); }
  };

  const createBracket = async () => {
    if (!newBracketName.trim()) return;
    const b: PlayoffBracket = { id: uuid(), seasonId: viewSeasonId === 'all' ? (data?.seasons?.find(s => s.isActive)?.id || 'default') : viewSeasonId, name: newBracketName.trim(), rounds: [], createdAt: new Date().toISOString() };
    await save([...playoffs, b]);
    setSelectedBracketId(b.id); setNewBracketName(''); setShowNewBracket(false);
    toastSuccess('Playoff creado');
  };

  const deleteBracket = async (id: string) => { await save(playoffs.filter(b => b.id !== id)); setSelectedBracketId(null); setConfirmDeleteBracket(null); toastSuccess('Playoff eliminado'); };

  const addRound = async () => {
    if (!selectedBracket || !newRoundName.trim()) return;
    const r: PlayoffRound = { id: uuid(), name: newRoundName.trim(), order: selectedBracket.rounds.length + 1, legFormat: newRoundFormat, ties: [] };
    const upd = { ...selectedBracket, rounds: [...selectedBracket.rounds, r] };
    await save(playoffs.map(b => b.id === upd.id ? upd : b));
    setNewRoundName(''); setExpandedRounds(v => [...v, r.id]); toastSuccess('Ronda añadida');
  };

  const deleteRound = async (roundId: string) => {
    if (!selectedBracket) return;
    await save(playoffs.map(b => b.id === selectedBracket.id ? { ...b, rounds: b.rounds.filter(r => r.id !== roundId) } : b));
    setConfirmDeleteRound(null); toastSuccess('Ronda eliminada');
  };

  const addTie = async (roundId: string, tie: PlayoffTie) => {
    if (!selectedBracket) return;
    await save(playoffs.map(b => b.id === selectedBracket.id ? { ...b, rounds: b.rounds.map(r => r.id === roundId ? { ...r, ties: [...r.ties, { ...tie, roundId }] } : r) } : b));
    setAddTieRoundId(null); toastSuccess('Enfrentamiento añadido');
  };

  const updateTie = async (roundId: string, tie: PlayoffTie) => {
    if (!selectedBracket) return;
    await save(playoffs.map(b => b.id === selectedBracket.id ? { ...b, rounds: b.rounds.map(r => r.id === roundId ? { ...r, ties: r.ties.map(t => t.id === tie.id ? tie : t) } : r) } : b));
  };

  const deleteTie = async (roundId: string, tieId: string) => {
    if (!selectedBracket) return;
    await save(playoffs.map(b => b.id === selectedBracket.id ? { ...b, rounds: b.rounds.map(r => r.id === roundId ? { ...r, ties: r.ties.filter(t => t.id !== tieId) } : r) } : b));
    toastSuccess('Enfrentamiento eliminado');
  };

  const toggleRound = (id: string) => setExpandedRounds(v => v.includes(id) ? v.filter(r => r !== id) : [...v, id]);

  if (visibleBrackets.length === 0 && !showNewBracket) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-2">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-6 pt-2 flex items-center justify-between">
          <div><h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Playoffs</h2><p className="text-slate-400 text-sm mt-1">{currentSeasonName}</p></div>
          {sessionRole === 'CAPTAIN' && <Button onClick={() => setShowNewBracket(true)}><Plus size={18}/> Crear Playoff</Button>}
        </header>
        <div className="text-center py-20 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-950 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="inline-flex bg-gradient-to-br from-yellow-400 to-orange-500 p-5 rounded-2xl mb-5 shadow-xl"><Trophy className="text-white" size={36}/></div>
          <p className="text-slate-600 dark:text-slate-300 font-black text-xl">Sin playoffs todavía</p>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">Crea un playoff para registrar tus eliminatorias. Las estadísticas de jugadores se actualizan automáticamente.</p>
          {sessionRole === 'CAPTAIN' && <button onClick={() => setShowNewBracket(true)} className="mt-6 px-8 py-3.5 bg-lime-400 hover:bg-lime-300 text-blue-950 font-black rounded-2xl shadow-lg shadow-lime-400/30 transition-all text-sm">+ Crear Playoff</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in slide-in-from-right-4 duration-300 pb-24">
      <ConfirmDialog isOpen={!!confirmDeleteBracket} title="¿Eliminar Playoff?" message="Se eliminarán todas las rondas y resultados." confirmLabel="Eliminar" onConfirm={() => confirmDeleteBracket && deleteBracket(confirmDeleteBracket)} onCancel={() => setConfirmDeleteBracket(null)}/>
      <ConfirmDialog isOpen={!!confirmDeleteRound} title="¿Eliminar Ronda?" message="Se eliminará esta ronda y todos sus enfrentamientos." confirmLabel="Eliminar" onConfirm={() => confirmDeleteRound && deleteRound(confirmDeleteRound)} onCancel={() => setConfirmDeleteRound(null)}/>
      {addTieRoundId && <AddTieModal ourTeamName={ourTeamName} gender={resolvedGender} onAdd={tie => addTie(addTieRoundId, tie)} onClose={() => setAddTieRoundId(null)}/>}

      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-5 sticky top-0 bg-slate-50 dark:bg-slate-950 z-20 pt-2">
        <div><h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Playoffs</h2><p className="text-slate-400 text-sm mt-0.5">{currentSeasonName}</p></div>
        {sessionRole === 'CAPTAIN' && <Button onClick={() => setShowNewBracket(v => !v)}><Plus size={18}/> Nuevo Playoff</Button>}
      </header>

      {showNewBracket && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-lime-200 dark:border-lime-800/40 p-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nombre del Playoff</p>
          <div className="flex gap-2">
            <input type="text" placeholder="Ej: Playoff Ascenso, Copa…" value={newBracketName} onChange={e => setNewBracketName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createBracket()} autoFocus className="flex-1 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"/>
            <button onClick={createBracket} disabled={!newBracketName.trim()} className="px-5 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-sm transition-all disabled:opacity-50">Crear</button>
            <button onClick={() => setShowNewBracket(false)} className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 transition-all"><X size={16}/></button>
          </div>
        </div>
      )}

      {visibleBrackets.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {visibleBrackets.map(b => (
            <button key={b.id} onClick={() => setSelectedBracketId(b.id)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${selectedBracket?.id === b.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>{b.name}</button>
          ))}
        </div>
      )}

      {selectedBracket && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-2xl px-5 py-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md"><Trophy size={20} className="text-white"/></div>
              <div>
                <h3 className="font-black text-xl text-white">{selectedBracket.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedBracket.rounds.length} ronda{selectedBracket.rounds.length !== 1 ? 's' : ''} · {selectedBracket.rounds.reduce((acc, r) => acc + r.ties.length, 0)} enfrentamientos</p>
              </div>
            </div>
            {sessionRole === 'CAPTAIN' && <button onClick={() => setConfirmDeleteBracket(selectedBracket.id)} className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-900/20 transition-all"><Trash2 size={16}/></button>}
          </div>

          <div className="space-y-3">
            {selectedBracket.rounds.map((round) => {
              const isExpanded = expandedRounds.includes(round.id);
              const wonTies = round.ties.filter(t => { const w = resolveTie(t); const wh = t.homeTeam === ourTeamName; return (wh && w === 'home') || (!wh && w === 'away'); }).length;
              const completedTies = round.ties.filter(t => resolveTie(t) !== 'pending').length;
              const gradients = ['from-blue-500 to-blue-600', 'from-purple-500 to-purple-600', 'from-orange-500 to-red-500', 'from-yellow-400 to-orange-500'];
              const colorClass = gradients[(round.order - 1) % gradients.length];

              return (
                <div key={round.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => toggleRound(round.id)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-xs font-black text-white shadow-sm shrink-0`}>{round.order}</div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-slate-900 dark:text-white">{round.name}</h4>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${round.legFormat === 'HOME_AWAY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{round.legFormat === 'HOME_AWAY' ? 'Ida y Vuelta' : 'Solo Ida'}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {round.ties.length} enfrentamiento{round.ties.length !== 1 ? 's' : ''}
                          {completedTies > 0 && <span className={`ml-1.5 font-bold ${wonTies === completedTies ? 'text-lime-500' : wonTies > 0 ? 'text-blue-400' : 'text-red-400'}`}>· {wonTies}/{completedTies} ganados</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sessionRole === 'CAPTAIN' && <button onClick={e => { e.stopPropagation(); setConfirmDeleteRound(round.id); }} className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"><Trash2 size={14}/></button>}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={14}/></div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                      {round.ties.length === 0 && <p className="text-center py-6 text-xs text-slate-400 italic">Sin enfrentamientos. Añade uno abajo.</p>}
                      {round.ties.map(tie => (
                        <TieCard key={tie.id} tie={tie} ourTeamName={ourTeamName} players={players} gender={resolvedGender} sessionRole={sessionRole} onUpdate={updated => updateTie(round.id, updated)} onDelete={() => deleteTie(round.id, tie.id)}/>
                      ))}
                      {sessionRole === 'CAPTAIN' && (
                        <button onClick={() => setAddTieRoundId(round.id)} className="w-full py-3.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-400 hover:border-lime-400 hover:text-lime-600 dark:hover:text-lime-400 transition-all flex items-center justify-center gap-2">
                          <Plus size={14}/> Añadir enfrentamiento
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {sessionRole === 'CAPTAIN' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nueva Ronda</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" placeholder="Ej: Cuartos de Final, Semifinal, Final…" value={newRoundName} onChange={e => setNewRoundName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRound()} className="flex-1 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"/>
                  <div className="flex gap-2">
                    <select value={newRoundFormat} onChange={e => setNewRoundFormat(e.target.value as PlayoffLegFormat)} className="text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none">
                      <option value="SINGLE">Solo Ida</option>
                      <option value="HOME_AWAY">Ida y Vuelta</option>
                    </select>
                    <button onClick={addRound} disabled={!newRoundName.trim()} className="px-5 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-sm transition-all shadow-md shadow-lime-400/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">+ Ronda</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayoffsView;
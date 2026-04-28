import React, { useState, useMemo } from 'react';
import {
  Trophy, Plus, Trash2, Edit2, ChevronDown, ChevronUp, ChevronRight,
  Check, X, AlertCircle, Shield, Home, Plane, Sword
} from '../Icons';
import { Button, ConfirmDialog } from '../UIComponents';
import {
  AppState, PlayoffBracket, PlayoffRound, PlayoffTie, PlayoffLeg,
  MatchLineup, MatchResult, PlayoffLegFormat
} from '../../types';
import { useToast } from '../Toast';
import { TANDA_OPTIONS } from '../../utils/constants';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const uuid = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

interface LegStats {
  matchWins: number;
  matchLosses: number;
  setsWon: number;
  setsLost: number;
}

function getLegStats(leg: PlayoffLeg): LegStats {
  let matchWins = 0, matchLosses = 0, setsWon = 0, setsLost = 0;
  for (const l of leg.lineups) {
    if (l.result === MatchResult.WIN) matchWins++;
    else if (l.result === MatchResult.LOSS) matchLosses++;
    // parse sets
    for (const set of [l.set1, l.set2, l.set3].filter(Boolean) as string[]) {
      const parts = set.split('-');
      if (parts.length === 2) {
        const [a, b] = parts.map(Number);
        const ours = leg.isHome ? a : b;
        const theirs = leg.isHome ? b : a;
        if (ours > theirs) setsWon++; else if (theirs > ours) setsLost++;
      }
    }
  }
  return { matchWins, matchLosses, setsWon, setsLost };
}

/**
 * Determine tie winner based on legs + seeds.
 * Returns 'home' | 'away' | 'pending'
 */
function resolveTie(tie: PlayoffTie): 'home' | 'away' | 'pending' {
  const completedLegs = tie.legs.filter(l => l.lineups.length > 0);
  if (completedLegs.length === 0) return 'pending';
  if (tie.legFormat === 'HOME_AWAY' && completedLegs.length < 2) return 'pending';

  // Aggregate across all legs
  let homePairWins = 0, awayPairWins = 0;
  let homeSets = 0, awaySets = 0;

  for (const leg of completedLegs) {
    const s = getLegStats(leg);
    if (leg.isHome) {
      // isHome = our team is home
      homePairWins += s.matchWins;
      awayPairWins += s.matchLosses;
      homeSets += s.setsWon;
      awaySets += s.setsLost;
    } else {
      // away leg — wins count as home wins too (we are always "home" in the tie)
      homePairWins += s.matchWins;
      awayPairWins += s.matchLosses;
      homeSets += s.setsWon;
      awaySets += s.setsLost;
    }
  }

  if (homePairWins > awayPairWins) return 'home';
  if (awayPairWins > homePairWins) return 'away';
  // Tiebreak 1: sets
  if (homeSets > awaySets) return 'home';
  if (awaySets > homeSets) return 'away';
  // Tiebreak 2: seed (lower seed = better classification = wins)
  if (tie.seedHome != null && tie.seedAway != null) {
    return tie.seedHome < tie.seedAway ? 'home' : 'away';
  }
  return 'pending';
}

function getTieAggregate(tie: PlayoffTie): { home: { wins: number; sets: number }; away: { wins: number; sets: number } } {
  let homeWins = 0, awayWins = 0, homeSets = 0, awaySets = 0;
  for (const leg of tie.legs) {
    const s = getLegStats(leg);
    homeWins += s.matchWins;
    awayWins += s.matchLosses;
    homeSets += s.setsWon;
    awaySets += s.setsLost;
  }
  return { home: { wins: homeWins, sets: homeSets }, away: { wins: awayWins, sets: awaySets } };
}

// ─── PROPS ───────────────────────────────────────────────────────────────────

interface PlayoffsViewProps {
  data: AppState | null;
  teamId: string | null;
  viewSeasonId: string;
  sessionRole: 'CAPTAIN' | 'GUEST';
  updateTeamData: (id: string, data: Partial<AppState>) => Promise<void>;
}

// ─── EMPTY LEG ───────────────────────────────────────────────────────────────

const emptyLeg = (isHome: boolean): PlayoffLeg => ({
  id: uuid(), isHome, lineups: [], tandas: '5', date: '', notes: '',
});

// ─── LINEUP EDITOR ───────────────────────────────────────────────────────────

interface LineupEditorProps {
  lineups: MatchLineup[];
  isHome: boolean;
  tandas: string;
  onUpdate: (lineups: MatchLineup[], tandas: string) => void;
}

const defaultLineup = (): MatchLineup => ({
  player1Id: '', player2Id: '', set1: '', set2: '', set3: '',
  result: MatchResult.DRAW, opponent1Name: '', opponent2Name: '', pairNumber: 1,
});

const LineupEditor: React.FC<LineupEditorProps> = ({ lineups, isHome, tandas, onUpdate }) => {
  const numPairs = parseInt(tandas?.split('-')[0] || '5', 10) <= 5 ? parseInt(tandas || '5', 10) : 5;
  const pairCount = !isNaN(numPairs) ? numPairs : 5;

  const ensuredLineups: MatchLineup[] = Array.from({ length: pairCount }, (_, i) =>
    lineups[i] ?? { ...defaultLineup(), pairNumber: i + 1 }
  );

  const update = (idx: number, field: keyof MatchLineup, val: string) => {
    const next = ensuredLineups.map((l, i) => i === idx ? { ...l, [field]: val } : l);
    // auto-calc result
    const updated = next.map(l => {
      const sets = [l.set1, l.set2, l.set3].filter(Boolean) as string[];
      if (sets.length === 0) return l;
      let w = 0, lv = 0;
      for (const s of sets) {
        const [a, b] = s.split('-').map(Number);
        if (isNaN(a) || isNaN(b)) continue;
        const ours = isHome ? a : b;
        const theirs = isHome ? b : a;
        if (ours > theirs) w++; else if (theirs > ours) lv++;
      }
      const result = w > lv ? MatchResult.WIN : lv > w ? MatchResult.LOSS : MatchResult.DRAW;
      return { ...l, result };
    });
    onUpdate(updated, tandas);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parejas</span>
        <select
          value={tandas}
          onChange={e => onUpdate(lineups, e.target.value)}
          className="text-xs font-bold bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200"
        >
          {TANDA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {ensuredLineups.map((lineup, idx) => {
        const isWin = lineup.result === MatchResult.WIN;
        const isLoss = lineup.result === MatchResult.LOSS;
        const hasData = lineup.set1 || lineup.opponent1Name;
        return (
          <div key={idx} className={`rounded-xl border p-3 space-y-2 ${hasData ? (isWin ? 'border-lime-200 bg-lime-50 dark:border-lime-800/40 dark:bg-lime-900/10' : isLoss ? 'border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10' : 'border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/10') : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50'}`}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase w-12 shrink-0">Pareja {idx + 1}</span>
              <div className="flex gap-1.5 flex-1">
                {['set1', 'set2', 'set3'].map(setKey => (
                  <input
                    key={setKey}
                    type="text"
                    placeholder={setKey === 'set3' ? 'Set 3' : setKey.replace('set', 'S')}
                    value={(lineup as any)[setKey] || ''}
                    onChange={e => update(idx, setKey as keyof MatchLineup, e.target.value)}
                    className="w-14 text-center text-xs font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1.5 placeholder-slate-300 focus:ring-2 focus:ring-lime-400 outline-none"
                  />
                ))}
                {hasData && (
                  <span className={`ml-1 text-[10px] font-black flex items-center ${isWin ? 'text-lime-600 dark:text-lime-400' : isLoss ? 'text-red-500' : 'text-blue-500'}`}>
                    {isWin ? '✓' : isLoss ? '✗' : '~'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text" placeholder="Rival 1"
                value={lineup.opponent1Name || ''}
                onChange={e => update(idx, 'opponent1Name', e.target.value)}
                className="flex-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 placeholder-slate-300 focus:ring-2 focus:ring-lime-400 outline-none text-slate-700 dark:text-slate-200"
              />
              <input
                type="text" placeholder="Rival 2"
                value={lineup.opponent2Name || ''}
                onChange={e => update(idx, 'opponent2Name', e.target.value)}
                className="flex-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 placeholder-slate-300 focus:ring-2 focus:ring-lime-400 outline-none text-slate-700 dark:text-slate-200"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── TIE CARD ────────────────────────────────────────────────────────────────

interface TieCardProps {
  tie: PlayoffTie;
  ourTeamName: string;
  sessionRole: 'CAPTAIN' | 'GUEST';
  onUpdate: (tie: PlayoffTie) => void;
  onDelete: () => void;
}

const TieCard: React.FC<TieCardProps> = ({ tie, ourTeamName, sessionRole, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [editingLegIdx, setEditingLegIdx] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const winner = resolveTie(tie);
  const agg = getTieAggregate(tie);
  const weAreHome = tie.homeTeam === ourTeamName;
  const ourAgg = weAreHome ? agg.home : agg.away;
  const theirAgg = weAreHome ? agg.away : agg.home;
  const isComplete = tie.legs.every(l => l.lineups.length > 0) && (tie.legFormat === 'SINGLE' ? tie.legs.length >= 1 : tie.legs.length >= 2);
  const weWon = winner === (weAreHome ? 'home' : 'away');
  const weLose = winner !== 'pending' && !weWon;

  const borderColor = !isComplete ? 'border-slate-200 dark:border-slate-700' : weWon ? 'border-lime-400' : weLose ? 'border-red-400' : 'border-blue-400';
  const bgColor = !isComplete ? '' : weWon ? 'bg-lime-50/30 dark:bg-lime-900/5' : weLose ? 'bg-red-50/30 dark:bg-red-900/5' : 'bg-blue-50/30 dark:bg-blue-900/5';

  const updateLeg = (idx: number, updated: PlayoffLeg) => {
    const newLegs = tie.legs.map((l, i) => i === idx ? updated : l);
    onUpdate({ ...tie, legs: newLegs });
  };

  const addLeg = (isHome: boolean) => {
    onUpdate({ ...tie, legs: [...tie.legs, emptyLeg(isHome)] });
  };

  return (
    <div className={`rounded-2xl border border-l-4 ${borderColor} ${bgColor} bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all overflow-hidden`}>
      <ConfirmDialog
        isOpen={confirmDelete}
        title="¿Eliminar enfrentamiento?"
        message={<>Se eliminará el enfrentamiento <strong>{tie.homeTeam} vs {tie.awayTeam}</strong> y todos sus resultados.</>}
        confirmLabel="Eliminar"
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Teams */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`font-black text-sm truncate ${weAreHome && isComplete && weWon ? 'text-lime-700 dark:text-lime-400' : weAreHome && isComplete && weLose ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                {tie.homeTeam}
              </span>
              <span className="text-slate-300 dark:text-slate-600 font-black">vs</span>
              <span className={`font-black text-sm truncate ${!weAreHome && isComplete && weWon ? 'text-lime-700 dark:text-lime-400' : !weAreHome && isComplete && weLose ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                {tie.awayTeam}
              </span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${tie.legFormat === 'HOME_AWAY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {tie.legFormat === 'HOME_AWAY' ? 'I+V' : 'Ida'}
              </span>
            </div>
            {/* Seeds */}
            {(tie.seedHome != null || tie.seedAway != null) && (
              <div className="flex gap-2 text-[10px] text-slate-400 mb-1">
                {tie.seedHome != null && <span>🏆 Pos. {tie.seedHome}</span>}
                {tie.seedAway != null && <span>• Rival pos. {tie.seedAway}</span>}
              </div>
            )}
          </div>

          {/* Score bubble */}
          <div className="flex items-center gap-2 shrink-0">
            {isComplete && (
              <div className="text-center">
                <div className={`text-xl font-black leading-none ${weWon ? 'text-lime-600 dark:text-lime-400' : weLose ? 'text-red-500 dark:text-red-400' : 'text-blue-500'}`}>
                  {ourAgg.wins} – {theirAgg.wins}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  Sets {ourAgg.sets}–{theirAgg.sets}
                </div>
              </div>
            )}
            {!isComplete && (
              <div className="text-xs font-bold text-slate-300 dark:text-slate-600 italic">Pendiente</div>
            )}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${expanded ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800'} text-slate-400`}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded legs */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
          {/* Edit seed info bar */}
          {sessionRole === 'CAPTAIN' && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clasificación (desempate)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number" placeholder="Pos. nosotros" min={1}
                  value={weAreHome ? (tie.seedHome ?? '') : (tie.seedAway ?? '')}
                  onChange={e => {
                    const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                    onUpdate(weAreHome ? { ...tie, seedHome: v } : { ...tie, seedAway: v });
                  }}
                  className="w-28 text-xs font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none"
                />
                <input
                  type="number" placeholder="Pos. rival" min={1}
                  value={weAreHome ? (tie.seedAway ?? '') : (tie.seedHome ?? '')}
                  onChange={e => {
                    const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                    onUpdate(weAreHome ? { ...tie, seedAway: v } : { ...tie, seedHome: v });
                  }}
                  className="w-28 text-xs font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none"
                />
              </div>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            </div>
          )}

          <div className="p-4 space-y-4">
            {tie.legs.map((leg, legIdx) => {
              const legStats = getLegStats(leg);
              const legHasData = leg.lineups.length > 0;
              const legWon = legStats.matchWins > legStats.matchLosses;
              const legLost = legStats.matchLosses > legStats.matchWins;
              const isEditing = editingLegIdx === legIdx;

              return (
                <div key={leg.id} className={`rounded-xl border ${legHasData ? (legWon ? 'border-lime-200 dark:border-lime-800/40' : legLost ? 'border-red-200 dark:border-red-800/40' : 'border-blue-200 dark:border-blue-800/40') : 'border-slate-200 dark:border-slate-700'} overflow-hidden`}>
                  {/* Leg header */}
                  <div className={`flex items-center justify-between px-3 py-2 ${legHasData ? (legWon ? 'bg-lime-50 dark:bg-lime-900/10' : legLost ? 'bg-red-50 dark:bg-red-900/10' : 'bg-blue-50 dark:bg-blue-900/10') : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${leg.isHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                        {leg.isHome ? '🏠 Casa' : '✈️ Fuera'}
                      </span>
                      {tie.legFormat === 'HOME_AWAY' && (
                        <span className="text-[10px] font-bold text-slate-400">{legIdx === 0 ? 'Ida' : 'Vuelta'}</span>
                      )}
                      {legHasData && (
                        <span className={`text-xs font-black ${legWon ? 'text-lime-600 dark:text-lime-400' : legLost ? 'text-red-500 dark:text-red-400' : 'text-blue-500'}`}>
                          {legStats.matchWins}–{legStats.matchLosses}
                          <span className="font-normal text-slate-400 text-[10px] ml-1">(Sets {legStats.setsWon}–{legStats.setsLost})</span>
                        </span>
                      )}
                    </div>
                    {sessionRole === 'CAPTAIN' && (
                      <button
                        onClick={() => setEditingLegIdx(isEditing ? null : legIdx)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Edit2 size={11} /> {isEditing ? 'Cerrar' : 'Editar'}
                      </button>
                    )}
                  </div>

                  {/* Leg lineups display */}
                  {!isEditing && legHasData && (
                    <div className="p-3 space-y-1.5">
                      {[...leg.lineups].sort((a, b) => (a.pairNumber ?? 99) - (b.pairNumber ?? 99)).map((l, i) => {
                        const isW = l.result === MatchResult.WIN;
                        const isL = l.result === MatchResult.LOSS;
                        const sets = [l.set1, l.set2, l.set3].filter(Boolean);
                        const displaySets = sets.map(s => {
                          if (!leg.isHome && s) {
                            const parts = s.split('-');
                            return parts.length === 2 ? `${parts[1]}-${parts[0]}` : s;
                          }
                          return s;
                        });
                        return (
                          <div key={i} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${isW ? 'bg-lime-50 dark:bg-lime-900/20' : isL ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                            <span className="font-bold text-slate-600 dark:text-slate-300 truncate text-[10px]">
                              P{l.pairNumber ?? i + 1}
                              {(l.opponent1Name || l.opponent2Name) && ` vs ${l.opponent1Name || '?'}/${l.opponent2Name || '?'}`}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {displaySets.map((s, si) => (
                                <span key={si} className={`font-black text-[11px] px-1.5 py-0.5 rounded ${isW ? 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : isL ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>{s}</span>
                              ))}
                              <span className={`font-black ml-1 ${isW ? 'text-lime-600 dark:text-lime-400' : isL ? 'text-red-500' : 'text-blue-500'}`}>
                                {isW ? '✓' : isL ? '✗' : '~'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Leg editor */}
                  {isEditing && sessionRole === 'CAPTAIN' && (
                    <div className="p-3">
                      <div className="flex gap-2 mb-3">
                        <input
                          type="datetime-local"
                          value={leg.date || ''}
                          onChange={e => updateLeg(legIdx, { ...leg, date: e.target.value })}
                          className="flex-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none"
                        />
                        <input
                          type="text" placeholder="Notas"
                          value={leg.notes || ''}
                          onChange={e => updateLeg(legIdx, { ...leg, notes: e.target.value })}
                          className="flex-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none placeholder-slate-300"
                        />
                      </div>
                      <LineupEditor
                        lineups={leg.lineups}
                        isHome={leg.isHome}
                        tandas={leg.tandas || '5'}
                        onUpdate={(lineups, tandas) => updateLeg(legIdx, { ...leg, lineups, tandas })}
                      />
                    </div>
                  )}

                  {/* Pending placeholder */}
                  {!isEditing && !legHasData && (
                    <div className="px-4 py-3 text-xs text-slate-400 italic text-center">Sin resultados — haz clic en Editar para añadir</div>
                  )}
                </div>
              );
            })}

            {/* Add second leg button */}
            {sessionRole === 'CAPTAIN' && tie.legFormat === 'HOME_AWAY' && tie.legs.length < 2 && (
              <button
                onClick={() => addLeg(!tie.legs[0]?.isHome)}
                className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:border-lime-400 hover:text-lime-600 transition-all"
              >
                + Añadir partido de vuelta
              </button>
            )}

            {/* Tiebreak explanation */}
            {isComplete && (
              <div className={`rounded-xl p-3 flex items-start gap-2 text-xs ${weWon ? 'bg-lime-50 dark:bg-lime-900/10 border border-lime-200 dark:border-lime-800/30' : weLose ? 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30' : 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30'}`}>
                <Check size={13} className={`mt-0.5 shrink-0 ${weWon ? 'text-lime-600' : weLose ? 'text-red-500' : 'text-blue-500'}`} />
                <div>
                  <span className={`font-black ${weWon ? 'text-lime-700 dark:text-lime-400' : weLose ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {weWon ? `¡Pasa a la siguiente ronda!` : weLose ? 'Eliminado' : 'Empate técnico'}
                  </span>
                  <span className="text-slate-500 ml-1">
                    {winner !== 'pending' && ourAgg.wins === theirAgg.wins && ourAgg.sets !== theirAgg.sets && ' (desempate por sets)'}
                    {winner !== 'pending' && ourAgg.wins === theirAgg.wins && ourAgg.sets === theirAgg.sets && ' (desempate por clasificación)'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ADD TIE MODAL ────────────────────────────────────────────────────────────

interface AddTieModalProps {
  ourTeamName: string;
  onAdd: (tie: PlayoffTie) => void;
  onClose: () => void;
}

const AddTieModal: React.FC<AddTieModalProps> = ({ ourTeamName, onAdd, onClose }) => {
  const [opponent, setOpponent] = useState('');
  const [weAreHome, setWeAreHome] = useState(true);
  const [legFormat, setLegFormat] = useState<PlayoffLegFormat>('SINGLE');
  const [seedUs, setSeedUs] = useState('');
  const [seedThem, setSeedThem] = useState('');

  const handleAdd = () => {
    if (!opponent.trim()) return;
    const homeTeam = weAreHome ? ourTeamName : opponent.trim();
    const awayTeam = weAreHome ? opponent.trim() : ourTeamName;
    const firstLegIsHome = weAreHome;
    const tie: PlayoffTie = {
      id: uuid(), roundId: '', homeTeam, awayTeam,
      seedHome: seedUs ? parseInt(seedUs) : undefined,
      seedAway: seedThem ? parseInt(seedThem) : undefined,
      legFormat,
      legs: [emptyLeg(firstLegIsHome)],
    };
    onAdd(tie);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700">
        <h3 className="font-black text-xl text-slate-900 dark:text-white mb-4">Nuevo enfrentamiento</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Rival</label>
            <input
              type="text" placeholder="Nombre del equipo rival" value={opponent}
              onChange={e => setOpponent(e.target.value)}
              className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Formato</label>
            <div className="grid grid-cols-2 gap-2">
              {(['SINGLE', 'HOME_AWAY'] as PlayoffLegFormat[]).map(f => (
                <button key={f} onClick={() => setLegFormat(f)} className={`py-2.5 rounded-xl text-xs font-black border transition-all ${legFormat === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                  {f === 'SINGLE' ? 'Solo Ida' : 'Ida y Vuelta'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Primer partido</label>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map(h => (
                <button key={String(h)} onClick={() => setWeAreHome(h)} className={`py-2.5 rounded-xl text-xs font-black border transition-all ${weAreHome === h ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                  {h ? '🏠 Jugamos en Casa' : '✈️ Jugamos Fuera'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Nuestra posición</label>
              <input type="number" min={1} placeholder="Ej: 3" value={seedUs} onChange={e => setSeedUs(e.target.value)}
                className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Posición del rival</label>
              <input type="number" min={1} placeholder="Ej: 5" value={seedThem} onChange={e => setSeedThem(e.target.value)}
                className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">Cancelar</button>
          <button onClick={handleAdd} disabled={!opponent.trim()} className="flex-1 py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-sm transition-all shadow-lg shadow-lime-400/30 disabled:opacity-50 disabled:cursor-not-allowed">Añadir</button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────

const PlayoffsView: React.FC<PlayoffsViewProps> = ({
  data, teamId, viewSeasonId, sessionRole, updateTeamData
}) => {
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
  const ourTeamName = data?.teamName || 'Nuestro Equipo';

  const currentSeasonName = useMemo(() => {
    if (viewSeasonId === 'all') return 'Todas';
    return data?.seasons?.find(s => s.id === viewSeasonId)?.name || viewSeasonId;
  }, [data, viewSeasonId]);

  const visibleBrackets = useMemo(() => {
    if (viewSeasonId === 'all') return playoffs;
    return playoffs.filter(b => b.seasonId === viewSeasonId);
  }, [playoffs, viewSeasonId]);

  const selectedBracket = useMemo(() =>
    visibleBrackets.find(b => b.id === selectedBracketId) ?? visibleBrackets[0] ?? null,
    [visibleBrackets, selectedBracketId]
  );

  const savePlayoffs = async (updated: PlayoffBracket[]) => {
    if (!teamId) return;
    try {
      await updateTeamData(teamId, { playoffs: updated });
    } catch (e: any) {
      toastError('Error al guardar: ' + (e.message || ''));
    }
  };

  const handleCreateBracket = async () => {
    if (!newBracketName.trim()) return;
    const bracket: PlayoffBracket = {
      id: uuid(),
      seasonId: viewSeasonId === 'all' ? (data?.seasons?.find(s => s.isActive)?.id || 'default') : viewSeasonId,
      name: newBracketName.trim(),
      rounds: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [...playoffs, bracket];
    await savePlayoffs(updated);
    setSelectedBracketId(bracket.id);
    setNewBracketName('');
    setShowNewBracket(false);
    toastSuccess('Playoff creado');
  };

  const handleDeleteBracket = async (bracketId: string) => {
    const updated = playoffs.filter(b => b.id !== bracketId);
    await savePlayoffs(updated);
    setSelectedBracketId(null);
    setConfirmDeleteBracket(null);
    toastSuccess('Playoff eliminado');
  };

  const handleAddRound = async () => {
    if (!selectedBracket || !newRoundName.trim()) return;
    const round: PlayoffRound = {
      id: uuid(),
      name: newRoundName.trim(),
      order: selectedBracket.rounds.length + 1,
      legFormat: newRoundFormat,
      ties: [],
    };
    const updatedBracket = { ...selectedBracket, rounds: [...selectedBracket.rounds, round] };
    const updated = playoffs.map(b => b.id === updatedBracket.id ? updatedBracket : b);
    await savePlayoffs(updated);
    setNewRoundName('');
    setExpandedRounds(v => [...v, round.id]);
    toastSuccess('Ronda añadida');
  };

  const handleDeleteRound = async (roundId: string) => {
    if (!selectedBracket) return;
    const updatedBracket = { ...selectedBracket, rounds: selectedBracket.rounds.filter(r => r.id !== roundId) };
    const updated = playoffs.map(b => b.id === updatedBracket.id ? updatedBracket : b);
    await savePlayoffs(updated);
    setConfirmDeleteRound(null);
    toastSuccess('Ronda eliminada');
  };

  const handleAddTie = async (roundId: string, tie: PlayoffTie) => {
    if (!selectedBracket) return;
    const updatedBracket = {
      ...selectedBracket,
      rounds: selectedBracket.rounds.map(r =>
        r.id === roundId ? { ...r, ties: [...r.ties, { ...tie, roundId }] } : r
      ),
    };
    const updated = playoffs.map(b => b.id === updatedBracket.id ? updatedBracket : b);
    await savePlayoffs(updated);
    setAddTieRoundId(null);
    toastSuccess('Enfrentamiento añadido');
  };

  const handleUpdateTie = async (roundId: string, tie: PlayoffTie) => {
    if (!selectedBracket) return;
    const updatedBracket = {
      ...selectedBracket,
      rounds: selectedBracket.rounds.map(r =>
        r.id === roundId ? { ...r, ties: r.ties.map(t => t.id === tie.id ? tie : t) } : r
      ),
    };
    const updated = playoffs.map(b => b.id === updatedBracket.id ? updatedBracket : b);
    await savePlayoffs(updated);
  };

  const handleDeleteTie = async (roundId: string, tieId: string) => {
    if (!selectedBracket) return;
    const updatedBracket = {
      ...selectedBracket,
      rounds: selectedBracket.rounds.map(r =>
        r.id === roundId ? { ...r, ties: r.ties.filter(t => t.id !== tieId) } : r
      ),
    };
    const updated = playoffs.map(b => b.id === updatedBracket.id ? updatedBracket : b);
    await savePlayoffs(updated);
    toastSuccess('Enfrentamiento eliminado');
  };

  const toggleRound = (id: string) => {
    setExpandedRounds(v => v.includes(id) ? v.filter(r => r !== id) : [...v, id]);
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (visibleBrackets.length === 0 && !showNewBracket) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-2">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-6 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Playoffs</h2>
              <p className="text-slate-400 text-sm mt-1">{currentSeasonName}</p>
            </div>
            {sessionRole === 'CAPTAIN' && (
              <Button onClick={() => setShowNewBracket(true)}>
                <Plus size={18} /> Crear Playoff
              </Button>
            )}
          </div>
        </header>
        <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="inline-flex bg-white dark:bg-slate-800 p-4 rounded-2xl mb-4 shadow-sm">
            <Trophy className="text-slate-300 dark:text-slate-600" size={32} />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">No hay playoffs creados</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Crea un nuevo playoff para esta temporada</p>
          {sessionRole === 'CAPTAIN' && (
            <button onClick={() => setShowNewBracket(true)} className="mt-6 px-6 py-3 bg-lime-400 hover:bg-lime-300 text-blue-950 font-black rounded-xl shadow-lg shadow-lime-400/30 transition-all text-sm">
              + Crear Playoff
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-24">

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={!!confirmDeleteBracket}
        title="¿Eliminar Playoff?"
        message="Se eliminarán todas las rondas y resultados de este playoff."
        confirmLabel="Eliminar"
        onConfirm={() => confirmDeleteBracket && handleDeleteBracket(confirmDeleteBracket)}
        onCancel={() => setConfirmDeleteBracket(null)}
      />
      <ConfirmDialog
        isOpen={!!confirmDeleteRound}
        title="¿Eliminar Ronda?"
        message="Se eliminará esta ronda y todos sus enfrentamientos."
        confirmLabel="Eliminar"
        onConfirm={() => confirmDeleteRound && handleDeleteRound(confirmDeleteRound)}
        onCancel={() => setConfirmDeleteRound(null)}
      />

      {/* Add tie modal */}
      {addTieRoundId && (
        <AddTieModal
          ourTeamName={ourTeamName}
          onAdd={tie => handleAddTie(addTieRoundId, tie)}
          onClose={() => setAddTieRoundId(null)}
        />
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sticky top-0 bg-slate-50 dark:bg-slate-950 z-20 pt-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Playoffs</h2>
          <p className="text-slate-400 text-sm mt-0.5">{currentSeasonName}</p>
        </div>
        {sessionRole === 'CAPTAIN' && (
          <Button onClick={() => setShowNewBracket(v => !v)}>
            <Plus size={18} /> Nuevo Playoff
          </Button>
        )}
      </header>

      {/* New bracket form */}
      {showNewBracket && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-lime-200 dark:border-lime-800/40 p-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <h4 className="font-black text-slate-900 dark:text-white mb-3 text-sm uppercase tracking-wide">Nombre del Playoff</h4>
          <div className="flex gap-3">
            <input
              type="text" placeholder="Ej: Playoff Ascenso, Copa…" value={newBracketName}
              onChange={e => setNewBracketName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateBracket()}
              className="flex-1 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"
            />
            <button onClick={handleCreateBracket} disabled={!newBracketName.trim()} className="px-5 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-sm transition-all shadow-md shadow-lime-400/20 disabled:opacity-50">
              Crear
            </button>
            <button onClick={() => setShowNewBracket(false)} className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Bracket selector tabs */}
      {visibleBrackets.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {visibleBrackets.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBracketId(b.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${selectedBracket?.id === b.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Selected bracket */}
      {selectedBracket && (
        <div className="space-y-4">
          {/* Bracket title bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                <Trophy size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-xl text-slate-900 dark:text-white">{selectedBracket.name}</h3>
                <p className="text-xs text-slate-400">{selectedBracket.rounds.length} rondas · {selectedBracket.rounds.reduce((acc, r) => acc + r.ties.length, 0)} enfrentamientos</p>
              </div>
            </div>
            {sessionRole === 'CAPTAIN' && (
              <button onClick={() => setConfirmDeleteBracket(selectedBracket.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Eliminar playoff">
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {/* Rounds */}
          <div className="space-y-3">
            {selectedBracket.rounds.map((round) => {
              const isExpanded = expandedRounds.includes(round.id);
              const completedTies = round.ties.filter(t => resolveTie(t) !== 'pending').length;
              const wonTies = round.ties.filter(t => {
                const w = resolveTie(t);
                const weHome = t.homeTeam === ourTeamName;
                return (weHome && w === 'home') || (!weHome && w === 'away');
              }).length;

              return (
                <div key={round.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Round header */}
                  <div
                    className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => toggleRound(round.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${round.order % 2 === 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                        {round.order}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 dark:text-white text-sm">{round.name}</h4>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${round.legFormat === 'HOME_AWAY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {round.legFormat === 'HOME_AWAY' ? 'Ida y Vuelta' : 'Solo Ida'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {round.ties.length} enfrentamiento{round.ties.length !== 1 ? 's' : ''}
                          {completedTies > 0 && ` · ${wonTies}/${completedTies} ganados`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sessionRole === 'CAPTAIN' && (
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteRound(round.id); }}
                          className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                  </div>

                  {/* Round ties */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                      {round.ties.length === 0 && (
                        <p className="text-center py-4 text-xs text-slate-400 italic">Sin enfrentamientos. Añade uno abajo.</p>
                      )}
                      {round.ties.map(tie => (
                        <TieCard
                          key={tie.id}
                          tie={tie}
                          ourTeamName={ourTeamName}
                          sessionRole={sessionRole}
                          onUpdate={updated => handleUpdateTie(round.id, updated)}
                          onDelete={() => handleDeleteTie(round.id, tie.id)}
                        />
                      ))}
                      {sessionRole === 'CAPTAIN' && (
                        <button
                          onClick={() => setAddTieRoundId(round.id)}
                          className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:border-lime-400 hover:text-lime-600 dark:hover:text-lime-400 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={14} /> Añadir enfrentamiento
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add round form */}
            {sessionRole === 'CAPTAIN' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nueva Ronda</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Ej: Cuartos de Final, Semifinal, Final…"
                    value={newRoundName}
                    onChange={e => setNewRoundName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddRound()}
                    className="flex-1 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newRoundFormat}
                      onChange={e => setNewRoundFormat(e.target.value as PlayoffLegFormat)}
                      className="text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none"
                    >
                      <option value="SINGLE">Solo Ida</option>
                      <option value="HOME_AWAY">Ida y Vuelta</option>
                    </select>
                    <button
                      onClick={handleAddRound}
                      disabled={!newRoundName.trim()}
                      className="px-5 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-sm transition-all shadow-md shadow-lime-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Ronda
                    </button>
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

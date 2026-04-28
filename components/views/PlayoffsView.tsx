import React, { useState, useMemo } from 'react';
import {
  Trophy, Plus, Trash2, Edit2, ChevronDown,
  X, Shield, Home, Plane, Users
} from '../Icons';
import { Button, ConfirmDialog } from '../UIComponents';
import {
  AppState, PlayoffBracket, PlayoffRound, PlayoffTie, PlayoffLeg,
  MatchLineup, MatchResult, PlayoffLegFormat, Player
} from '../../types';
import { useToast } from '../Toast';
import { TANDA_OPTIONS } from '../../utils/constants';

const uuid = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

interface LegStats { matchWins: number; matchLosses: number; setsWon: number; setsLost: number; }

function getLegStats(leg: PlayoffLeg): LegStats {
  let matchWins = 0, matchLosses = 0, setsWon = 0, setsLost = 0;
  for (const l of leg.lineups) {
    if (l.result === MatchResult.WIN) matchWins++;
    else if (l.result === MatchResult.LOSS) matchLosses++;
    // Format is always "ours-theirs"
    for (const set of [l.set1, l.set2, l.set3].filter(Boolean) as string[]) {
      const parts = set.split('-');
      if (parts.length === 2) {
        const ours = Number(parts[0]);
        const theirs = Number(parts[1]);
        if (!isNaN(ours) && !isNaN(theirs)) {
          if (ours > theirs) setsWon++; else if (theirs > ours) setsLost++;
        }
      }
    }
  }
  return { matchWins, matchLosses, setsWon, setsLost };
}

function resolveTie(tie: PlayoffTie): 'home' | 'away' | 'pending' {
  const completedLegs = tie.legs.filter(l => l.lineups.length > 0);
  if (completedLegs.length === 0) return 'pending';
  if (tie.legFormat === 'HOME_AWAY' && completedLegs.length < 2) return 'pending';
  let homePairWins = 0, awayPairWins = 0, homeSets = 0, awaySets = 0;
  for (const leg of completedLegs) {
    const s = getLegStats(leg);
    homePairWins += s.matchWins; awayPairWins += s.matchLosses;
    homeSets += s.setsWon; awaySets += s.setsLost;
  }
  if (homePairWins > awayPairWins) return 'home';
  if (awayPairWins > homePairWins) return 'away';
  if (homeSets > awaySets) return 'home';
  if (awaySets > homeSets) return 'away';
  if (tie.seedHome != null && tie.seedAway != null) return tie.seedHome < tie.seedAway ? 'home' : 'away';
  return 'pending';
}

function getTieAggregate(tie: PlayoffTie) {
  let homeWins = 0, awayWins = 0, homeSets = 0, awaySets = 0;
  for (const leg of tie.legs) {
    const s = getLegStats(leg);
    homeWins += s.matchWins; awayWins += s.matchLosses;
    homeSets += s.setsWon; awaySets += s.setsLost;
  }
  return { home: { wins: homeWins, sets: homeSets }, away: { wins: awayWins, sets: awaySets } };
}

interface PlayoffsViewProps {
  data: AppState | null;
  teamId: string | null;
  viewSeasonId: string;
  sessionRole: 'CAPTAIN' | 'GUEST';
  updateTeamData: (id: string, data: Partial<AppState>) => Promise<void>;
}

const emptyLeg = (isHome: boolean): PlayoffLeg => ({
  id: uuid(), isHome, lineups: [], tandas: '5', date: '', notes: '',
});

const defaultLineup = (): MatchLineup => ({
  player1Id: '', player2Id: '', set1: '', set2: '', set3: '',
  result: MatchResult.DRAW, opponent1Name: '', opponent2Name: '', pairNumber: 1,
});

// ─── LINEUP EDITOR ───────────────────────────────────────────────────────────

interface LineupEditorProps {
  lineups: MatchLineup[];
  isHome: boolean;
  tandas: string;
  players: Player[];
  availablePlayers: string[];
  onUpdate: (lineups: MatchLineup[], tandas: string) => void;
}

const LineupEditor: React.FC<LineupEditorProps> = ({ lineups, isHome, tandas, players, availablePlayers, onUpdate }) => {
  const numPairs = parseInt(tandas?.split('-')[0] || '5', 10);
  const pairCount = !isNaN(numPairs) && numPairs <= 5 ? numPairs : 5;

  const ensuredLineups: MatchLineup[] = Array.from({ length: pairCount }, (_, i) =>
    lineups[i] ?? { ...defaultLineup(), pairNumber: i + 1 }
  );

  const update = (idx: number, field: keyof MatchLineup, val: string) => {
    const next = ensuredLineups.map((l, i) => i === idx ? { ...l, [field]: val } : l);
    const updated = next.map(l => {
      const sets = [l.set1, l.set2, l.set3].filter(Boolean) as string[];
      if (sets.length === 0) return l;
      let w = 0, lv = 0;
      for (const s of sets) {
        // Format is always "ours-theirs" regardless of home/away
        const [ours, theirs] = s.split('-').map(Number);
        if (isNaN(ours) || isNaN(theirs)) continue;
        if (ours > theirs) w++; else if (theirs > ours) lv++;
      }
      return { ...l, result: w > lv ? MatchResult.WIN : lv > w ? MatchResult.LOSS : MatchResult.DRAW };
    });
    onUpdate(updated, tandas);
  };

  // Helper: parse "ours-theirs" from stored set string
  const parseSet = (val: string | undefined): [string, string] => {
    if (!val) return ['', ''];
    const parts = val.split('-');
    return parts.length === 2 ? [parts[0], parts[1]] : ['', ''];
  };

  // Helper: update one half of a set field and merge back to "ours-theirs"
  const updateSetHalf = (idx: number, setKey: 'set1' | 'set2' | 'set3', half: 'ours' | 'theirs', val: string) => {
    const current = (ensuredLineups[idx][setKey] as string) || '';
    const [ours, theirs] = parseSet(current);
    const next = half === 'ours'
      ? `${val}-${theirs}`
      : `${ours}-${val}`;
    // Only store if at least one side has a value
    const cleaned = (val === '' && (half === 'ours' ? theirs : ours) === '') ? '' : next;
    update(idx, setKey, cleaned);
  };

  // Filter to available players only; if none selected yet → empty list with hint
  const allSorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const filteredPlayers = availablePlayers.length > 0
    ? allSorted.filter(p => availablePlayers.includes(p.id))
    : [];

  const playerOptions = availablePlayers.length > 0
    ? [
        { value: '', label: '— Seleccionar —' },
        ...filteredPlayers.map(p => ({ value: p.id, label: p.name }))
      ]
    : [{ value: '', label: '— Marca disponibles primero —' }];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tandas</span>
        <select
          value={tandas}
          onChange={e => onUpdate(lineups, e.target.value)}
          className="text-xs font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none"
        >
          {TANDA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {ensuredLineups.map((lineup, idx) => {
        const isWin = lineup.result === MatchResult.WIN;
        const isLoss = lineup.result === MatchResult.LOSS;
        const hasSets = !!(lineup.set1 || lineup.set2);
        const hasPlayer = !!(lineup.player1Id || lineup.player2Id);
        const hasData = hasSets || hasPlayer;
        const p1Name = allSorted.find((p: Player) => p.id === lineup.player1Id)?.name;
        const p2Name = allSorted.find((p: Player) => p.id === lineup.player2Id)?.name;

        return (
          <div key={idx} className={`rounded-2xl border-2 overflow-hidden transition-all ${
            hasData
              ? isWin ? 'border-lime-300 dark:border-lime-700' : isLoss ? 'border-red-300 dark:border-red-700' : 'border-blue-200 dark:border-blue-800'
              : 'border-slate-200 dark:border-slate-700'
          }`}>
            {/* Pair header */}
            <div className={`px-3 py-2 flex items-center justify-between ${
              hasData
                ? isWin ? 'bg-lime-50 dark:bg-lime-900/20' : isLoss ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
                : 'bg-slate-50 dark:bg-slate-800/50'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 ${
                  isWin ? 'bg-lime-500' : isLoss ? 'bg-red-500' : hasSets ? 'bg-blue-400' : 'bg-slate-300 dark:bg-slate-600'
                }`}>{idx + 1}</span>
                {(p1Name || p2Name) ? (
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                    {p1Name || '?'} / {p2Name || '?'}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">Pareja {idx + 1}</span>
                )}
              </div>
              {hasSets && (
                <span className={`text-xs font-black ${isWin ? 'text-lime-600 dark:text-lime-400' : isLoss ? 'text-red-500' : 'text-blue-500'}`}>
                  {isWin ? '✓ Victoria' : isLoss ? '✗ Derrota' : '~ Empate'}
                </span>
              )}
            </div>

            {/* Pair form */}
            <div className="p-3 space-y-2.5 bg-white dark:bg-slate-900">
              {/* Our players */}
              {availablePlayers.length === 0 && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2">
                  ⚠️ Marca los jugadores disponibles arriba para poder seleccionarlos aquí.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Jugador Revés</label>
                  <select
                    value={lineup.player1Id || ''}
                    onChange={e => update(idx, 'player1Id', e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-2 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none"
                  >
                    {playerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Jugador Drive</label>
                  <select
                    value={lineup.player2Id || ''}
                    onChange={e => update(idx, 'player2Id', e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-2 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none"
                  >
                    {playerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Sets — two fields per set: Nos / Ellos */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-2">
                  {(['set1', 'set2', 'set3'] as ('set1' | 'set2' | 'set3')[]).map((setKey, si) => {
                    const [ours, theirs] = parseSet((lineup[setKey] as string) || '');
                    const oursN = Number(ours), theirsN = Number(theirs);
                    const setPlayed = ours !== '' || theirs !== '';
                    const setWon = setPlayed && !isNaN(oursN) && !isNaN(theirsN) && oursN > theirsN;
                    const setLost = setPlayed && !isNaN(oursN) && !isNaN(theirsN) && theirsN > oursN;
                    return (
                      <div key={setKey} className={`rounded-xl border overflow-hidden ${
                        !setPlayed ? 'border-slate-200 dark:border-slate-700'
                        : setWon ? 'border-lime-300 dark:border-lime-700'
                        : setLost ? 'border-red-300 dark:border-red-700'
                        : 'border-blue-200 dark:border-blue-800'
                      }`}>
                        <div className={`text-[9px] font-black text-center py-0.5 uppercase tracking-wider ${
                          !setPlayed ? 'bg-slate-50 dark:bg-slate-800 text-slate-400'
                          : setWon ? 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400'
                          : setLost ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        }`}>
                          Set {si + 1}{si === 2 ? ' (opt.)' : ''}
                        </div>
                        <div className="flex">
                          <div className="flex-1 flex flex-col items-center border-r border-slate-200 dark:border-slate-700">
                            <span className="text-[8px] font-black text-slate-400 uppercase pt-1">Nos</span>
                            <input
                              type="number" min={0} max={99}
                              value={ours}
                              onChange={e => updateSetHalf(idx, setKey, 'ours', e.target.value)}
                              placeholder="–"
                              className="w-full text-center text-base font-black bg-transparent pb-1.5 pt-0.5 outline-none placeholder-slate-300 text-slate-800 dark:text-white"
                            />
                          </div>
                          <div className="flex-1 flex flex-col items-center">
                            <span className="text-[8px] font-black text-slate-400 uppercase pt-1">Ellos</span>
                            <input
                              type="number" min={0} max={99}
                              value={theirs}
                              onChange={e => updateSetHalf(idx, setKey, 'theirs', e.target.value)}
                              placeholder="–"
                              className="w-full text-center text-base font-black bg-transparent pb-1.5 pt-0.5 outline-none placeholder-slate-300 text-slate-800 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rival names */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Rival Revés</label>
                  <input
                    type="text" placeholder="Nombre rival"
                    value={lineup.opponent1Name || ''}
                    onChange={e => update(idx, 'opponent1Name', e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-2 placeholder-slate-300 focus:ring-2 focus:ring-lime-400 outline-none text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Rival Drive</label>
                  <input
                    type="text" placeholder="Nombre rival"
                    value={lineup.opponent2Name || ''}
                    onChange={e => update(idx, 'opponent2Name', e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-2 placeholder-slate-300 focus:ring-2 focus:ring-lime-400 outline-none text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>
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
  players: Player[];
  sessionRole: 'CAPTAIN' | 'GUEST';
  onUpdate: (tie: PlayoffTie) => void;
  onDelete: () => void;
}

const TieCard: React.FC<TieCardProps> = ({ tie, ourTeamName, players, sessionRole, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [editingLegIdx, setEditingLegIdx] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const winner = resolveTie(tie);
  const agg = getTieAggregate(tie);
  const weAreHome = tie.homeTeam === ourTeamName;
  const ourAgg = weAreHome ? agg.home : agg.away;
  const theirAgg = weAreHome ? agg.away : agg.home;
  const opponent = weAreHome ? tie.awayTeam : tie.homeTeam;
  const isComplete = tie.legs.every(l => l.lineups.length > 0) && (tie.legFormat === 'SINGLE' ? tie.legs.length >= 1 : tie.legs.length >= 2);
  const weWon = winner === (weAreHome ? 'home' : 'away');
  const weLose = winner !== 'pending' && !weWon;

  const updateLeg = (idx: number, updated: PlayoffLeg) => {
    const newLegs = tie.legs.map((l, i) => i === idx ? updated : l);
    onUpdate({ ...tie, legs: newLegs });
  };

  const addLeg = (isHome: boolean) => {
    onUpdate({ ...tie, legs: [...tie.legs, emptyLeg(isHome)] });
  };

  const borderClass = isComplete
    ? weWon ? 'border-lime-400' : weLose ? 'border-red-400' : 'border-blue-400'
    : 'border-slate-200 dark:border-slate-700';

  return (
    <div className={`rounded-2xl border-2 ${borderClass} bg-white dark:bg-slate-900 shadow-sm overflow-hidden`}>
      <ConfirmDialog
        isOpen={confirmDelete}
        title="¿Eliminar enfrentamiento?"
        message={<>Se eliminará <strong>{tie.homeTeam} vs {tie.awayTeam}</strong> y todos sus resultados.</>}
        confirmLabel="Eliminar"
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Header — always visible */}
      <div className="p-4 cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
        {/* Badges row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
              weAreHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            }`}>
              {weAreHome ? <Home size={10} /> : <Plane size={10} />}
              {weAreHome ? 'Casa' : 'Fuera'}
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {tie.legFormat === 'HOME_AWAY' ? 'Ida y vuelta' : 'Solo ida'}
            </span>
          </div>
          {/* Status badge */}
          {isComplete && (
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg text-white ${weWon ? 'bg-lime-500' : weLose ? 'bg-red-500' : 'bg-blue-500'}`}>
              {weWon ? '🏆 Clasificados' : weLose ? '❌ Eliminados' : '⚖️ Empate'}
            </span>
          )}
          {!isComplete && (
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400">
              ⏳ Pendiente
            </span>
          )}
        </div>

        {/* Score board */}
        <div className="flex items-stretch gap-2">
          {/* Us */}
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1">
              <Shield size={9}/> Nosotros
            </div>
            <div className="font-black text-sm text-slate-900 dark:text-white truncate">{ourTeamName}</div>
            {isComplete && (
              <div className={`text-3xl font-black leading-none mt-1 ${weWon ? 'text-lime-600 dark:text-lime-400' : weLose ? 'text-red-500' : 'text-blue-500'}`}>
                {ourAgg.wins}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex flex-col items-center justify-center px-1 shrink-0">
            {isComplete ? (
              <>
                <div className="text-lg font-black text-slate-300 dark:text-slate-600">–</div>
                <div className="text-[9px] text-slate-400 font-bold mt-1 text-center whitespace-nowrap">
                  {ourAgg.sets}–{theirAgg.sets} sets
                </div>
              </>
            ) : (
              <div className="text-sm font-black text-slate-300 dark:text-slate-600">vs</div>
            )}
          </div>

          {/* Rival */}
          <div className="flex-1 min-w-0 text-right">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1 justify-end">
              Rival <Users size={9}/>
            </div>
            <div className="font-black text-sm text-slate-600 dark:text-slate-300 truncate">{opponent}</div>
            {isComplete && (
              <div className={`text-3xl font-black leading-none mt-1 ${weLose ? 'text-red-500' : 'text-slate-400'}`}>
                {theirAgg.wins}
              </div>
            )}
          </div>
        </div>

        {/* Seeds */}
        {(tie.seedHome != null || tie.seedAway != null) && (
          <div className="flex gap-3 mt-2 text-[10px] text-slate-400 flex-wrap">
            <span>🏅 Nosotros: pos. {weAreHome ? tie.seedHome : tie.seedAway}</span>
            <span>· Rival: pos. {weAreHome ? tie.seedAway : tie.seedHome}</span>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] text-slate-400 font-bold">{tie.legs.length} partido{tie.legs.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1.5">
            {sessionRole === 'CAPTAIN' && (
              <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
                className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                <Trash2 size={13}/>
              </button>
            )}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
              <ChevronDown size={13}/>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3 animate-in slide-in-from-top-1 duration-150">
          {tie.legs.map((leg, legIdx) => {
            const legStats = getLegStats(leg);
            const legHasData = leg.lineups.length > 0;
            const legWon = legStats.matchWins > legStats.matchLosses;
            const legLost = legStats.matchLosses > legStats.matchWins;
            const isEditing = editingLegIdx === legIdx;

            return (
              <div key={leg.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Leg header */}
                <div className={`flex items-center justify-between px-3 py-2.5 border-b border-slate-100 dark:border-slate-700 ${
                  legHasData
                    ? legWon ? 'bg-lime-50 dark:bg-lime-900/20' : legLost ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
                    : 'bg-slate-50 dark:bg-slate-800/50'
                }`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg flex items-center gap-1 ${
                      leg.isHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {leg.isHome ? <Home size={9}/> : <Plane size={9}/>}
                      {tie.legFormat === 'HOME_AWAY' ? (legIdx === 0 ? 'Ida' : 'Vuelta') : 'Partido único'}
                    </span>
                    {leg.date && (
                      <span className="text-[10px] text-slate-400 font-bold">
                        {new Date(leg.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {(leg.availablePlayers || []).length > 0 && !legHasData && (
                      <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 flex items-center gap-1">
                        <Users size={9}/> {(leg.availablePlayers || []).length} disp.
                      </span>
                    )}
                    {legHasData && (
                      <span className={`text-xs font-black ${legWon ? 'text-lime-600 dark:text-lime-400' : legLost ? 'text-red-500' : 'text-blue-500'}`}>
                        {legStats.matchWins}–{legStats.matchLosses}
                        <span className="font-normal text-slate-400 text-[10px] ml-1">({legStats.setsWon}–{legStats.setsLost} sets)</span>
                      </span>
                    )}
                  </div>
                  {sessionRole === 'CAPTAIN' && (
                    <button
                      onClick={() => setEditingLegIdx(isEditing ? null : legIdx)}
                      className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                        isEditing
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200'
                      }`}
                    >
                      <Edit2 size={11}/> {isEditing ? 'Cerrar' : 'Editar'}
                    </button>
                  )}
                </div>

                {/* Leg read-only view */}
                {!isEditing && legHasData && (
                  <div className="p-3 space-y-1.5 bg-white dark:bg-slate-900">
                    {[...leg.lineups].sort((a, b) => (a.pairNumber ?? 99) - (b.pairNumber ?? 99)).map((l, i) => {
                      const isW = l.result === MatchResult.WIN;
                      const isL = l.result === MatchResult.LOSS;
                      const sets = [l.set1, l.set2, l.set3].filter(Boolean);
                      // Format is always "ours-theirs" — no flipping needed
                      const displaySets = sets as string[];
                      const p1 = players.find(p => p.id === l.player1Id);
                      const p2 = players.find(p => p.id === l.player2Id);
                      return (
                        <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isW ? 'bg-lime-50 dark:bg-lime-900/20' : isL ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 ${isW ? 'bg-lime-500' : isL ? 'bg-red-500' : 'bg-slate-400'}`}>
                            {l.pairNumber ?? i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-700 dark:text-slate-200 text-[11px] truncate">
                              {(p1 || p2) ? `${p1?.name || '?'} / ${p2?.name || '?'}` : `Pareja ${l.pairNumber ?? i + 1}`}
                            </div>
                            {(l.opponent1Name || l.opponent2Name) && (
                              <div className="text-[10px] text-slate-400 truncate">vs {l.opponent1Name || '?'} / {l.opponent2Name || '?'}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {displaySets.map((s, si) => (
                              <span key={si} className={`font-black text-[11px] px-1.5 py-0.5 rounded-lg ${isW ? 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : isL ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>{s}</span>
                            ))}
                            <span className={`font-black text-sm ml-0.5 ${isW ? 'text-lime-500' : isL ? 'text-red-500' : 'text-blue-400'}`}>
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
                  <div className="p-3 space-y-3 bg-white dark:bg-slate-900">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Fecha y hora</label>
                        <input type="datetime-local" value={leg.date || ''}
                          onChange={e => updateLeg(legIdx, { ...leg, date: e.target.value })}
                          className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-2 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Notas</label>
                        <input type="text" placeholder="Opcional…" value={leg.notes || ''}
                          onChange={e => updateLeg(legIdx, { ...leg, notes: e.target.value })}
                          className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-2 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none placeholder-slate-300"
                        />
                      </div>
                    </div>

                    {/* Availability picker */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60">
                        <div>
                          <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Jugadores disponibles</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            {(leg.availablePlayers || []).length === 0
                              ? 'Marca quién juega — solo ellos aparecerán para seleccionar'
                              : `${(leg.availablePlayers || []).length} seleccionados`}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const allIds = players.map(p => p.id);
                            const currentAvail = leg.availablePlayers || [];
                            const allSelected = allIds.every(id => currentAvail.includes(id));
                            updateLeg(legIdx, { ...leg, availablePlayers: allSelected ? [] : allIds });
                          }}
                          className="text-[10px] font-black text-blue-500 hover:text-blue-600 underline shrink-0"
                        >
                          {players.every(p => (leg.availablePlayers || []).includes(p.id)) ? 'Quitar todos' : 'Todos'}
                        </button>
                      </div>
                      <div className="p-2 grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                        {[...players].sort((a, b) => a.name.localeCompare(b.name)).map(p => {
                          const isAvail = (leg.availablePlayers || []).includes(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => {
                                const current = leg.availablePlayers || [];
                                const next = isAvail ? current.filter(id => id !== p.id) : [...current, p.id];
                                updateLeg(legIdx, { ...leg, availablePlayers: next });
                              }}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-xs font-bold transition-all text-left ${
                                isAvail
                                  ? 'bg-lime-50 dark:bg-lime-900/20 border-lime-400 dark:border-lime-700 text-slate-800 dark:text-lime-100'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              <div className={`w-2 h-2 rounded-full shrink-0 ${isAvail ? 'bg-lime-500' : 'bg-slate-300 dark:bg-slate-600'}`}/>
                              <span className="truncate">{p.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <LineupEditor
                      lineups={leg.lineups}
                      isHome={leg.isHome}
                      tandas={leg.tandas || '5'}
                      players={players}
                      availablePlayers={leg.availablePlayers || []}
                      onUpdate={(lineups, tandas) => updateLeg(legIdx, { ...leg, lineups, tandas })}
                    />
                  </div>
                )}

                {/* Empty placeholder */}
                {!isEditing && !legHasData && (
                  <div className="px-4 py-4 text-center bg-white dark:bg-slate-900">
                    <p className="text-xs text-slate-400 italic">Sin resultados todavía</p>
                    {sessionRole === 'CAPTAIN' && (
                      <button onClick={() => setEditingLegIdx(legIdx)}
                        className="mt-1.5 text-xs font-bold text-blue-500 hover:text-blue-600 underline">
                        Añadir resultados
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add second leg */}
          {sessionRole === 'CAPTAIN' && tie.legFormat === 'HOME_AWAY' && tie.legs.length < 2 && (
            <button onClick={() => addLeg(!tie.legs[0]?.isHome)}
              className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:border-lime-400 hover:text-lime-600 dark:hover:text-lime-400 transition-all flex items-center justify-center gap-2">
              <Plus size={14}/> Añadir partido de vuelta
            </button>
          )}

          {/* Result summary */}
          {isComplete && (
            <div className={`rounded-2xl p-4 flex items-start gap-3 border-2 ${
              weWon ? 'bg-lime-50 dark:bg-lime-900/10 border-lime-200 dark:border-lime-800/40'
              : weLose ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40'
              : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40'
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base ${weWon ? 'bg-lime-500' : weLose ? 'bg-red-500' : 'bg-blue-500'}`}>
                {weWon ? '🏆' : weLose ? '❌' : '⚖️'}
              </div>
              <div>
                <p className={`font-black text-sm ${weWon ? 'text-lime-700 dark:text-lime-400' : weLose ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {weWon ? '¡Clasificados para la siguiente ronda!' : weLose ? 'Eliminados del torneo' : 'Empate técnico'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Global: <strong>{ourAgg.wins}</strong> – <strong>{theirAgg.wins}</strong> partidos · {ourAgg.sets}–{theirAgg.sets} sets
                  {winner !== 'pending' && ourAgg.wins === theirAgg.wins && ourAgg.sets !== theirAgg.sets && ' · desempate por sets'}
                  {winner !== 'pending' && ourAgg.wins === theirAgg.wins && ourAgg.sets === theirAgg.sets && ' · desempate por clasificación'}
                </p>
              </div>
            </div>
          )}
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
    const tie: PlayoffTie = {
      id: uuid(), roundId: '', homeTeam, awayTeam,
      seedHome: seedUs ? parseInt(seedUs) : undefined,
      seedAway: seedThem ? parseInt(seedThem) : undefined,
      legFormat, legs: [emptyLeg(weAreHome)],
    };
    onAdd(tie);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-200">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
            <Trophy size={18} className="text-white"/>
          </div>
          <h3 className="font-black text-xl text-slate-900 dark:text-white">Nuevo enfrentamiento</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Equipo rival</label>
            <input type="text" placeholder="Nombre del equipo rival" value={opponent}
              onChange={e => setOpponent(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              autoFocus
              className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Primer partido</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ val: true, icon: '🏠', label: 'En casa' }, { val: false, icon: '✈️', label: 'Fuera' }].map(({ val, icon, label }) => (
                <button key={String(val)} onClick={() => setWeAreHome(val)}
                  className={`py-3 rounded-xl text-sm font-black border-2 transition-all ${weAreHome === val ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Formato</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ val: 'SINGLE' as PlayoffLegFormat, label: 'Solo Ida' }, { val: 'HOME_AWAY' as PlayoffLegFormat, label: 'Ida y Vuelta' }].map(({ val, label }) => (
                <button key={val} onClick={() => setLegFormat(val)}
                  className={`py-2.5 rounded-xl text-xs font-black border-2 transition-all ${legFormat === val ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Nuestra pos.</label>
              <input type="number" min={1} placeholder="Ej: 3" value={seedUs} onChange={e => setSeedUs(e.target.value)}
                className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"/>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Pos. rival</label>
              <input type="number" min={1} placeholder="Ej: 5" value={seedThem} onChange={e => setSeedThem(e.target.value)}
                className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"/>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">Cancelar</button>
          <button onClick={handleAdd} disabled={!opponent.trim()}
            className="flex-1 py-3.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-sm transition-all shadow-lg shadow-lime-400/30 disabled:opacity-50 disabled:cursor-not-allowed">
            Añadir
          </button>
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
  const players = useMemo(() => data?.players || [], [data]);
  const ourTeamName = data?.teamName || 'Nuestro Equipo';

  const currentSeasonName = useMemo(() => {
    if (viewSeasonId === 'all') return 'Todas las temporadas';
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
    try { await updateTeamData(teamId, { playoffs: updated }); }
    catch (e: any) { toastError('Error al guardar: ' + (e.message || '')); }
  };

  const handleCreateBracket = async () => {
    if (!newBracketName.trim()) return;
    const bracket: PlayoffBracket = {
      id: uuid(),
      seasonId: viewSeasonId === 'all' ? (data?.seasons?.find(s => s.isActive)?.id || 'default') : viewSeasonId,
      name: newBracketName.trim(), rounds: [], createdAt: new Date().toISOString(),
    };
    await savePlayoffs([...playoffs, bracket]);
    setSelectedBracketId(bracket.id);
    setNewBracketName(''); setShowNewBracket(false);
    toastSuccess('Playoff creado');
  };

  const handleDeleteBracket = async (bracketId: string) => {
    await savePlayoffs(playoffs.filter(b => b.id !== bracketId));
    setSelectedBracketId(null); setConfirmDeleteBracket(null);
    toastSuccess('Playoff eliminado');
  };

  const handleAddRound = async () => {
    if (!selectedBracket || !newRoundName.trim()) return;
    const round: PlayoffRound = {
      id: uuid(), name: newRoundName.trim(),
      order: selectedBracket.rounds.length + 1, legFormat: newRoundFormat, ties: [],
    };
    const updatedBracket = { ...selectedBracket, rounds: [...selectedBracket.rounds, round] };
    await savePlayoffs(playoffs.map(b => b.id === updatedBracket.id ? updatedBracket : b));
    setNewRoundName('');
    setExpandedRounds(v => [...v, round.id]);
    toastSuccess('Ronda añadida');
  };

  const handleDeleteRound = async (roundId: string) => {
    if (!selectedBracket) return;
    const updatedBracket = { ...selectedBracket, rounds: selectedBracket.rounds.filter(r => r.id !== roundId) };
    await savePlayoffs(playoffs.map(b => b.id === updatedBracket.id ? updatedBracket : b));
    setConfirmDeleteRound(null); toastSuccess('Ronda eliminada');
  };

  const handleAddTie = async (roundId: string, tie: PlayoffTie) => {
    if (!selectedBracket) return;
    const updatedBracket = { ...selectedBracket, rounds: selectedBracket.rounds.map(r => r.id === roundId ? { ...r, ties: [...r.ties, { ...tie, roundId }] } : r) };
    await savePlayoffs(playoffs.map(b => b.id === updatedBracket.id ? updatedBracket : b));
    setAddTieRoundId(null); toastSuccess('Enfrentamiento añadido');
  };

  const handleUpdateTie = async (roundId: string, tie: PlayoffTie) => {
    if (!selectedBracket) return;
    const updatedBracket = { ...selectedBracket, rounds: selectedBracket.rounds.map(r => r.id === roundId ? { ...r, ties: r.ties.map(t => t.id === tie.id ? tie : t) } : r) };
    await savePlayoffs(playoffs.map(b => b.id === updatedBracket.id ? updatedBracket : b));
  };

  const handleDeleteTie = async (roundId: string, tieId: string) => {
    if (!selectedBracket) return;
    const updatedBracket = { ...selectedBracket, rounds: selectedBracket.rounds.map(r => r.id === roundId ? { ...r, ties: r.ties.filter(t => t.id !== tieId) } : r) };
    await savePlayoffs(playoffs.map(b => b.id === updatedBracket.id ? updatedBracket : b));
    toastSuccess('Enfrentamiento eliminado');
  };

  const toggleRound = (id: string) => setExpandedRounds(v => v.includes(id) ? v.filter(r => r !== id) : [...v, id]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (visibleBrackets.length === 0 && !showNewBracket) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-2">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-6 pt-2 flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Playoffs</h2>
            <p className="text-slate-400 text-sm mt-1">{currentSeasonName}</p>
          </div>
          {sessionRole === 'CAPTAIN' && <Button onClick={() => setShowNewBracket(true)}><Plus size={18}/> Crear Playoff</Button>}
        </header>
        <div className="text-center py-20 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-950 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="inline-flex bg-gradient-to-br from-yellow-400 to-orange-500 p-5 rounded-2xl mb-5 shadow-xl shadow-orange-200 dark:shadow-orange-900/20">
            <Trophy className="text-white" size={36}/>
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-black text-xl">Sin playoffs todavía</p>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
            Crea un playoff para registrar tus eliminatorias. Las estadísticas de jugadores se actualizan automáticamente.
          </p>
          {sessionRole === 'CAPTAIN' && (
            <button onClick={() => setShowNewBracket(true)}
              className="mt-6 px-8 py-3.5 bg-lime-400 hover:bg-lime-300 text-blue-950 font-black rounded-2xl shadow-lg shadow-lime-400/30 transition-all text-sm">
              + Crear Playoff
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in slide-in-from-right-4 duration-300 pb-24">
      <ConfirmDialog isOpen={!!confirmDeleteBracket} title="¿Eliminar Playoff?"
        message="Se eliminarán todas las rondas y resultados de este playoff." confirmLabel="Eliminar"
        onConfirm={() => confirmDeleteBracket && handleDeleteBracket(confirmDeleteBracket)}
        onCancel={() => setConfirmDeleteBracket(null)}/>
      <ConfirmDialog isOpen={!!confirmDeleteRound} title="¿Eliminar Ronda?"
        message="Se eliminará esta ronda y todos sus enfrentamientos." confirmLabel="Eliminar"
        onConfirm={() => confirmDeleteRound && handleDeleteRound(confirmDeleteRound)}
        onCancel={() => setConfirmDeleteRound(null)}/>
      {addTieRoundId && (
        <AddTieModal ourTeamName={ourTeamName} onAdd={tie => handleAddTie(addTieRoundId, tie)} onClose={() => setAddTieRoundId(null)}/>
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-5 sticky top-0 bg-slate-50 dark:bg-slate-950 z-20 pt-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Playoffs</h2>
          <p className="text-slate-400 text-sm mt-0.5">{currentSeasonName}</p>
        </div>
        {sessionRole === 'CAPTAIN' && (
          <Button onClick={() => setShowNewBracket(v => !v)}><Plus size={18}/> Nuevo Playoff</Button>
        )}
      </header>

      {/* New bracket form */}
      {showNewBracket && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-lime-200 dark:border-lime-800/40 p-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nombre del Playoff</p>
          <div className="flex gap-2">
            <input type="text" placeholder="Ej: Playoff Ascenso, Copa…" value={newBracketName}
              onChange={e => setNewBracketName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateBracket()}
              autoFocus
              className="flex-1 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"/>
            <button onClick={handleCreateBracket} disabled={!newBracketName.trim()}
              className="px-5 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-sm transition-all shadow-md shadow-lime-400/20 disabled:opacity-50">
              Crear
            </button>
            <button onClick={() => setShowNewBracket(false)}
              className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 transition-all">
              <X size={16}/>
            </button>
          </div>
        </div>
      )}

      {/* Bracket tabs */}
      {visibleBrackets.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {visibleBrackets.map(b => (
            <button key={b.id} onClick={() => setSelectedBracketId(b.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${selectedBracket?.id === b.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Selected bracket */}
      {selectedBracket && (
        <div className="space-y-4">
          {/* Bracket title */}
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-2xl px-5 py-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                <Trophy size={20} className="text-white"/>
              </div>
              <div>
                <h3 className="font-black text-xl text-white">{selectedBracket.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedBracket.rounds.length} ronda{selectedBracket.rounds.length !== 1 ? 's' : ''} · {selectedBracket.rounds.reduce((acc, r) => acc + r.ties.length, 0)} enfrentamientos
                </p>
              </div>
            </div>
            {sessionRole === 'CAPTAIN' && (
              <button onClick={() => setConfirmDeleteBracket(selectedBracket.id)}
                className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-900/20 transition-all" title="Eliminar playoff">
                <Trash2 size={16}/>
              </button>
            )}
          </div>

          {/* Rounds */}
          <div className="space-y-3">
            {selectedBracket.rounds.map((round) => {
              const isExpanded = expandedRounds.includes(round.id);
              const completedTies = round.ties.filter(t => resolveTie(t) !== 'pending').length;
              const wonTies = round.ties.filter(t => {
                const w = resolveTie(t); const weHome = t.homeTeam === ourTeamName;
                return (weHome && w === 'home') || (!weHome && w === 'away');
              }).length;
              const roundGradients = ['from-blue-500 to-blue-600', 'from-purple-500 to-purple-600', 'from-orange-500 to-red-500', 'from-yellow-400 to-orange-500'];
              const colorClass = roundGradients[(round.order - 1) % roundGradients.length];

              return (
                <div key={round.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => toggleRound(round.id)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-xs font-black text-white shadow-sm shrink-0`}>
                        {round.order}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-slate-900 dark:text-white">{round.name}</h4>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${round.legFormat === 'HOME_AWAY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {round.legFormat === 'HOME_AWAY' ? 'Ida y Vuelta' : 'Solo Ida'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {round.ties.length} enfrentamiento{round.ties.length !== 1 ? 's' : ''}
                          {completedTies > 0 && (
                            <span className={`ml-1.5 font-bold ${wonTies === completedTies ? 'text-lime-500' : wonTies > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                              · {wonTies}/{completedTies} ganados
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sessionRole === 'CAPTAIN' && (
                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteRound(round.id); }}
                          className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                          <Trash2 size={14}/>
                        </button>
                      )}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={14}/>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                      {round.ties.length === 0 && (
                        <p className="text-center py-6 text-xs text-slate-400 italic">Sin enfrentamientos. Añade uno abajo.</p>
                      )}
                      {round.ties.map(tie => (
                        <TieCard key={tie.id} tie={tie} ourTeamName={ourTeamName} players={players}
                          sessionRole={sessionRole}
                          onUpdate={updated => handleUpdateTie(round.id, updated)}
                          onDelete={() => handleDeleteTie(round.id, tie.id)}/>
                      ))}
                      {sessionRole === 'CAPTAIN' && (
                        <button onClick={() => setAddTieRoundId(round.id)}
                          className="w-full py-3.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-400 hover:border-lime-400 hover:text-lime-600 dark:hover:text-lime-400 transition-all flex items-center justify-center gap-2">
                          <Plus size={14}/> Añadir enfrentamiento
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add round */}
            {sessionRole === 'CAPTAIN' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nueva Ronda</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" placeholder="Ej: Cuartos de Final, Semifinal, Final…"
                    value={newRoundName} onChange={e => setNewRoundName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddRound()}
                    className="flex-1 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-400 outline-none"/>
                  <div className="flex gap-2">
                    <select value={newRoundFormat} onChange={e => setNewRoundFormat(e.target.value as PlayoffLegFormat)}
                      className="text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-lime-400 outline-none">
                      <option value="SINGLE">Solo Ida</option>
                      <option value="HOME_AWAY">Ida y Vuelta</option>
                    </select>
                    <button onClick={handleAddRound} disabled={!newRoundName.trim()}
                      className="px-5 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-blue-950 font-black text-sm transition-all shadow-md shadow-lime-400/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
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

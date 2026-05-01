import React, { useState, useMemo } from 'react';
import { AppState, MatchResult, MatchDay, MatchLineup } from '../../types';
import { User, Calendar, Home, Plane, Trophy, TrendingUp, TrendingDown, Minus, Search, ChevronDown, ChevronUp, Filter } from '../Icons';

interface PlayerHistoryViewProps {
  data: AppState | null;
  viewSeasonId: string;
}

interface PlayerMatchEntry {
  match: MatchDay;
  lineup: MatchLineup;
  partnerName: string;
  opp1: string;
  opp2: string;
}

const ResultBadge = ({ result }: { result: MatchResult }) => {
  const map = {
    [MatchResult.WIN]: { label: 'V', cls: 'bg-lime-400/20 text-lime-600 dark:text-lime-400 border border-lime-400/30' },
    [MatchResult.LOSS]: { label: 'D', cls: 'bg-red-400/20 text-red-600 dark:text-red-400 border border-red-400/30' },
    [MatchResult.DRAW]: { label: 'E', cls: 'bg-blue-400/20 text-blue-600 dark:text-blue-400 border border-blue-400/30' },
  };
  const { label, cls } = map[result] ?? { label: '?', cls: 'bg-slate-200 text-slate-500' };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black ${cls}`}>
      {label}
    </span>
  );
};

const StatPill = ({ value, label, color }: { value: number; label: string; color: string }) => (
  <div className="flex flex-col items-center">
    <span className={`text-lg font-black ${color}`}>{value}</span>
    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

const PlayerHistoryView: React.FC<PlayerHistoryViewProps> = ({ data, viewSeasonId }) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [filterResult, setFilterResult] = useState<'ALL' | 'WIN' | 'LOSS' | 'DRAW'>('ALL');
  const [filterLocation, setFilterLocation] = useState<'ALL' | 'HOME' | 'AWAY'>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const filteredMatches = useMemo(() => {
    if (!data) return [];
    if (viewSeasonId === 'all') return data.matches;
    return data.matches.filter(m => m.seasonId === viewSeasonId || (!m.seasonId && viewSeasonId === 'default'));
  }, [data, viewSeasonId]);

  const playedMatches = useMemo(() =>
    filteredMatches.filter(m => m.lineups && m.lineups.length > 0),
    [filteredMatches]
  );

  const playerHistory = useMemo((): PlayerMatchEntry[] => {
    if (!selectedPlayerId || !data) return [];
    const entries: PlayerMatchEntry[] = [];
    for (const match of playedMatches) {
      for (const lineup of match.lineups) {
        const isP1 = lineup.player1Id === selectedPlayerId;
        const isP2 = lineup.player2Id === selectedPlayerId;
        if (!isP1 && !isP2) continue;
        const partnerId = isP1 ? lineup.player2Id : lineup.player1Id;
        const partner = data.players.find(p => p.id === partnerId);
        entries.push({
          match,
          lineup,
          partnerName: partner ? partner.name : '(Desconocido)',
          opp1: lineup.opponent1Name || '?',
          opp2: lineup.opponent2Name || '?',
        });
      }
    }
    return entries.sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());
  }, [selectedPlayerId, playedMatches, data]);

  const filteredHistory = useMemo(() => {
    return playerHistory.filter(e => {
      if (filterResult !== 'ALL') {
        if (filterResult === 'WIN' && e.lineup.result !== MatchResult.WIN) return false;
        if (filterResult === 'LOSS' && e.lineup.result !== MatchResult.LOSS) return false;
        if (filterResult === 'DRAW' && e.lineup.result !== MatchResult.DRAW) return false;
      }
      if (filterLocation !== 'ALL') {
        if (filterLocation === 'HOME' && !e.match.isHome) return false;
        if (filterLocation === 'AWAY' && e.match.isHome) return false;
      }
      return true;
    });
  }, [playerHistory, filterResult, filterLocation]);

  const stats = useMemo(() => {
    const wins = playerHistory.filter(e => e.lineup.result === MatchResult.WIN).length;
    const losses = playerHistory.filter(e => e.lineup.result === MatchResult.LOSS).length;
    const draws = playerHistory.filter(e => e.lineup.result === MatchResult.DRAW).length;
    const total = playerHistory.length;
    const homeWins = playerHistory.filter(e => e.match.isHome && e.lineup.result === MatchResult.WIN).length;
    const homePlayed = playerHistory.filter(e => e.match.isHome).length;
    const awayWins = playerHistory.filter(e => !e.match.isHome && e.lineup.result === MatchResult.WIN).length;
    const awayPlayed = playerHistory.filter(e => !e.match.isHome).length;
    // Top partner
    const partnerCount: Record<string, { name: string; wins: number; losses: number; draws: number; played: number; recentResults: MatchResult[] }> = {};
    playerHistory.forEach(e => {
      if (!partnerCount[e.partnerName]) partnerCount[e.partnerName] = { name: e.partnerName, wins: 0, losses: 0, draws: 0, played: 0, recentResults: [] };
      partnerCount[e.partnerName].played++;
      if (e.lineup.result === MatchResult.WIN) partnerCount[e.partnerName].wins++;
      else if (e.lineup.result === MatchResult.LOSS) partnerCount[e.partnerName].losses++;
      else partnerCount[e.partnerName].draws++;
      partnerCount[e.partnerName].recentResults.unshift(e.lineup.result); // most recent first (history is sorted desc)
    });
    const partners = Object.values(partnerCount).sort((a, b) => b.played - a.played);
    return { wins, losses, draws, total, homeWins, homePlayed, awayWins, awayPlayed, partners };
  }, [playerHistory]);

  const selectedPlayer = data?.players.find(p => p.id === selectedPlayerId);
  const filteredPlayers = data?.players.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  const formatSets = (l: MatchLineup) => {
    const sets = [l.set1, l.set2, l.set3].filter(Boolean);
    if (sets.length === 0) return '—';
    return sets.join(' | ');
  };

  if (!data) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Estadísticas</p>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Historial por Jugador</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Con quién jugó, contra quién, casa o fuera</p>
      </header>

      {/* Player selector */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <User size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-black text-slate-900 dark:text-white text-sm">Seleccionar Jugador</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar jugador..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {filteredPlayers.map(p => {
              const isSelected = selectedPlayerId === p.id;
              const pStats = (() => {
                let played = 0, wins = 0;
                for (const m of playedMatches) {
                  for (const l of m.lineups) {
                    if (l.player1Id === p.id || l.player2Id === p.id) {
                      played++;
                      if (l.result === MatchResult.WIN) wins++;
                    }
                  }
                }
                return { played, wins };
              })();
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPlayerId(p.id); setExpandedMatchId(null); }}
                  className={`text-left px-3 py-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                  }`}
                >
                  <p className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{p.name}</p>
                  <p className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                    {pStats.played > 0 ? `${pStats.wins}V / ${pStats.played - pStats.wins}D · ${pStats.played} partidos` : 'Sin partidos'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Player stats summary */}
      {selectedPlayer && playerHistory.length > 0 && (
        <div className="bg-gradient-to-br from-blue-950 to-blue-900 rounded-2xl p-5 text-white border border-blue-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-lime-400 blur-[80px] opacity-10 rounded-full pointer-events-none" />
          <div className="flex items-start justify-between gap-4 mb-5 relative z-10">
            <div>
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">Jugador seleccionado</p>
              <h3 className="text-2xl font-black text-white">{selectedPlayer.name}</h3>
              <p className="text-blue-300 text-sm font-medium mt-0.5">{stats.total} partidos individuales</p>
            </div>
            <div className="bg-blue-800/60 border border-blue-700/50 rounded-2xl px-4 py-2 text-center">
              <span className="block text-2xl font-black text-lime-400">
                {stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%
              </span>
              <span className="text-[9px] text-blue-400 font-bold uppercase">Win Rate</span>
            </div>
          </div>
          
          {/* Win/Loss/Draw */}
          <div className="grid grid-cols-3 gap-3 mb-4 relative z-10">
            <div className="bg-lime-400/10 border border-lime-400/20 rounded-xl p-3 text-center">
              <span className="block text-xl font-black text-lime-400">{stats.wins}</span>
              <span className="text-[9px] text-lime-300 font-bold uppercase">Victorias</span>
            </div>
            <div className="bg-blue-700/30 border border-blue-600/30 rounded-xl p-3 text-center">
              <span className="block text-xl font-black text-blue-300">{stats.draws}</span>
              <span className="text-[9px] text-blue-400 font-bold uppercase">Empates</span>
            </div>
            <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-3 text-center">
              <span className="block text-xl font-black text-red-400">{stats.losses}</span>
              <span className="text-[9px] text-red-300 font-bold uppercase">Derrotas</span>
            </div>
          </div>

          {/* Home / Away */}
          <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
            <div className="bg-blue-800/40 border border-blue-700/40 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-sm">🏠</div>
              <div>
                <p className="text-xs font-black text-white">{stats.homeWins}/{stats.homePlayed} casa</p>
                <p className="text-[10px] text-blue-400 font-medium">
                  {stats.homePlayed > 0 ? Math.round((stats.homeWins / stats.homePlayed) * 100) : 0}% WR local
                </p>
              </div>
            </div>
            <div className="bg-blue-800/40 border border-blue-700/40 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center text-sm">✈️</div>
              <div>
                <p className="text-xs font-black text-white">{stats.awayWins}/{stats.awayPlayed} fuera</p>
                <p className="text-[10px] text-blue-400 font-medium">
                  {stats.awayPlayed > 0 ? Math.round((stats.awayWins / stats.awayPlayed) * 100) : 0}% WR visitante
                </p>
              </div>
            </div>
          </div>

          {/* Top partners */}
          {stats.partners.length > 0 && (
            <div className="relative z-10">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Compañeros habituales</p>
              <div className="space-y-2">
                {stats.partners.slice(0, 4).map(partner => {
                  const wr = partner.played > 0 ? Math.round((partner.wins / partner.played) * 100) : 0;
                  const recent = partner.recentResults.slice(0, 5);
                  return (
                    <div key={partner.name} className="bg-blue-800/50 border border-blue-700/40 rounded-xl px-3 py-2.5">
                      {/* Name + WR bar */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-white text-xs font-black">{partner.name}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg ${wr >= 50 ? 'bg-lime-400/20 text-lime-400' : 'bg-red-400/20 text-red-400'}`}>
                          {wr}% WR
                        </span>
                      </div>
                      {/* V / E / D counts */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-lime-400">{partner.wins}V</span>
                        {partner.draws > 0 && <span className="text-[10px] font-black text-blue-300">{partner.draws}E</span>}
                        <span className="text-[10px] font-black text-red-400">{partner.losses}D</span>
                        <span className="text-[10px] text-blue-500 font-medium ml-auto">{partner.played} partido{partner.played !== 1 ? 's' : ''}</span>
                      </div>
                      {/* Recent form dots */}
                      {recent.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mr-1">Forma:</span>
                          {recent.map((r, i) => (
                            <div key={i} className={`w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-black ${
                              r === MatchResult.WIN ? 'bg-lime-400/20 text-lime-400 border border-lime-400/30'
                              : r === MatchResult.LOSS ? 'bg-red-400/20 text-red-400 border border-red-400/30'
                              : 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                            }`}>
                              {r === MatchResult.WIN ? 'V' : r === MatchResult.LOSS ? 'D' : 'E'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters & Match list */}
      {selectedPlayer && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Filters header */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className="w-full flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <Filter size={14} className="text-slate-500" />
              </div>
              <div className="text-left">
                <h3 className="font-black text-slate-900 dark:text-white text-sm">
                  Partidos — {filteredHistory.length} resultado{filteredHistory.length !== 1 ? 's' : ''}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  {filterResult !== 'ALL' || filterLocation !== 'ALL' ? 'Filtros activos' : 'Sin filtros'}
                </p>
              </div>
            </div>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-400 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}>
              <ChevronDown size={13} />
            </div>
          </button>

          {showFilters && (
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Resultado</p>
                <div className="flex gap-2">
                  {(['ALL', 'WIN', 'LOSS', 'DRAW'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setFilterResult(r)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                        filterResult === r
                          ? r === 'WIN' ? 'bg-lime-400 text-blue-950 border-lime-400'
                          : r === 'LOSS' ? 'bg-red-500 text-white border-red-500'
                          : r === 'DRAW' ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-800 dark:border-slate-200'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-400'
                      }`}
                    >
                      {r === 'ALL' ? 'Todos' : r === 'WIN' ? 'Victoria' : r === 'LOSS' ? 'Derrota' : 'Empate'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Localía</p>
                <div className="flex gap-2">
                  {(['ALL', 'HOME', 'AWAY'] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => setFilterLocation(l)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                        filterLocation === l
                          ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-800 dark:border-slate-200'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-400'
                      }`}
                    >
                      {l === 'ALL' ? 'Todos' : l === 'HOME' ? '🏠 Casa' : '✈️ Fuera'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Match list */}
          {filteredHistory.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Calendar size={20} className="text-slate-400" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                {playerHistory.length === 0
                  ? `${selectedPlayer.name} no tiene partidos registrados`
                  : 'No hay partidos con los filtros seleccionados'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredHistory.map((entry, idx) => {
                const isExpanded = expandedMatchId === `${entry.match.id}-${idx}`;
                const entryKey = `${entry.match.id}-${idx}`;
                const isWin = entry.lineup.result === MatchResult.WIN;
                const isLoss = entry.lineup.result === MatchResult.LOSS;

                return (
                  <div key={entryKey}>
                    <button
                      onClick={() => setExpandedMatchId(isExpanded ? null : entryKey)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                        isWin ? 'bg-lime-50/30 dark:bg-lime-900/5' : isLoss ? 'bg-red-50/30 dark:bg-red-900/5' : ''
                      }`}
                    >
                      {/* Result indicator */}
                      <div className={`w-1.5 shrink-0 self-stretch rounded-full ${isWin ? 'bg-lime-400' : isLoss ? 'bg-red-400' : 'bg-blue-400'}`} />

                      <div className="flex-1 min-w-0">
                        {/* Rival + location */}
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            entry.match.isHome
                              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}>
                            {entry.match.isHome ? '🏠 Casa' : '✈️ Fuera'}
                          </span>
                          <span className="text-xs font-black text-slate-800 dark:text-white truncate">
                            vs {entry.match.opponent}
                          </span>
                        </div>
                        {/* Partner */}
                        <p className="text-[10px] text-slate-400 font-medium">
                          Con <span className="text-slate-600 dark:text-slate-300 font-bold">{entry.partnerName}</span>
                          {' · '}
                          {new Date(entry.match.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </p>
                      </div>

                      {/* Sets score */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 tabular-nums hidden sm:block">
                          {formatSets(entry.lineup)}
                        </span>
                        <ResultBadge result={entry.lineup.result} />
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown size={12} />
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-slate-50/50 dark:bg-slate-700/20 animate-in slide-in-from-top-1 duration-150">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-3">
                          {/* Pair vs opponents */}
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nuestro equipo</p>
                              <p className="text-xs font-black text-slate-800 dark:text-white truncate">{selectedPlayer.name}</p>
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">{entry.partnerName}</p>
                            </div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                              isWin ? 'bg-lime-100 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400'
                              : isLoss ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'
                            }`}>
                              {isWin ? 'W' : isLoss ? 'L' : 'E'}
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Rivales</p>
                              {entry.opp1 !== '?' ? (
                                <>
                                  <p className="text-xs font-black text-slate-800 dark:text-white truncate">{entry.opp1}</p>
                                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">{entry.opp2}</p>
                                </>
                              ) : (
                                <p className="text-xs text-slate-400">Sin datos</p>
                              )}
                            </div>
                          </div>

                          {/* Sets */}
                          <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Marcador por sets</p>
                            <div className="flex gap-2">
                              {[entry.lineup.set1, entry.lineup.set2, entry.lineup.set3]
                                .filter(Boolean)
                                .map((set, i) => (
                                  <div key={i} className="bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-center">
                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 tabular-nums">{set}</span>
                                    <p className="text-[8px] text-slate-400 font-medium">Set {i + 1}</p>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {/* Pair number if available */}
                          {entry.lineup.pairNumber !== undefined && (
                            <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Pareja #{entry.lineup.pairNumber + 1}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* No player selected placeholder */}
      {!selectedPlayerId && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-10 text-center shadow-sm">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User size={24} className="text-blue-400" />
          </div>
          <h3 className="font-black text-slate-800 dark:text-white text-base mb-1">Selecciona un jugador</h3>
          <p className="text-slate-400 text-sm font-medium">Verás todos sus partidos: compañero, rival, resultado y sets</p>
        </div>
      )}
    </div>
  );
};

export default PlayerHistoryView;
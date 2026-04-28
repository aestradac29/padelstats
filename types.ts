

export enum Position {
  DRIVE = 'Drive',
  REVES = 'Revés',
  AMBOS = 'Ambos'
}

export enum MatchResult {
  WIN = 'Victoria',
  LOSS = 'Derrota',
  DRAW = 'Empate'
}

export interface Player {
  id: string;
  name: string;
  surname?: string; // Kept for backward compatibility but deprecated in UI
  position: Position;
  level: number; // 1.0 to 7.0 - We keep this for AI matching
  initialPoints: number; // Global/Fallback initial points
  handedness: 'right' | 'left'; // New field
  photoUrl?: string; // Base64 string for player photo
  matchesPlayed: number;
  wins: number;
  email?: string;
}

export interface MatchLineup {
  player1Id: string;
  player2Id: string;
  set1: string; // e.g., "6-4"
  set2: string;
  set3?: string;
  result: MatchResult;
  opponent1Name?: string;
  opponent2Name?: string;
  opponentPoints?: number; // Points of the rival pair for dynamic scoring
  pairNumber?: number; // New field
}

export interface MatchDay {
  id: string;
  date: string; // ISO String with time
  opponent: string;
  isHome: boolean; // True = Casa, False = Fuera
  lineups: MatchLineup[];
  notes?: string;
  tandas?: string; // New field: e.g., "5", "4-1", "2-2-1"
  seasonId?: string; // New field to link match to a season
  availablePlayers?: string[]; // Array of player IDs who were available/called up for this match
  ignorePoints?: boolean; // If true, stats count but points are not added (Historical matches)
  isRestDay?: boolean; // New field: True if it's a rest day
}

export interface ScoringRange {
  min: number;
  max: number;
  win: number;
  loss: number;
}

export interface TeamSettings {
  scoringSystem: 'SIMPLE' | 'RANGES' | 'NONE'; // Toggle between simple, ranges or disabled
  pointsPerWin: number;
  pointsPerLoss: number;
  pointsPerDraw: number;
  pointsAttendance: number;
  ranges: ScoringRange[]; // Array of ranges for RANGES system
  gender?: 'MASCULINO' | 'FEMENINO'; // New field for team gender
}

export interface Season {
  id: string;
  name: string;
  isActive: boolean; // Determines if new matches are assigned to this season
  settings?: TeamSettings; // Specific settings for this season
  playerStartPoints?: Record<string, number>; // Map playerId -> start points for this season
}

export interface AppState {
  teamName: string;
  captainName: string;
  players: Player[];
  matches: MatchDay[];
  settings: TeamSettings; // Global/Fallback settings
  seasons?: Season[]; // Array of seasons
  playoffs?: PlayoffBracket[]; // Playoff brackets
}

export type ViewState = 'LOGIN' | 'DASHBOARD' | 'PLAYERS' | 'MATCHES' | 'LINEUP' | 'SETTINGS' | 'QUICK_LINEUP' | 'PAIRS' | 'PLAYOFFS';

// ─── PLAYOFF TYPES ───────────────────────────────────────────────────────────

export type PlayoffLegFormat = 'SINGLE' | 'HOME_AWAY'; // ida o ida y vuelta

export type PlayoffTieResult = 'WIN' | 'LOSS' | 'PENDING';

/** A single leg (partido de ida o vuelta) within a tie */
export interface PlayoffLeg {
  id: string;
  matchDayId?: string; // linked to a MatchDay in the main calendar (optional)
  isHome: boolean;
  lineups: MatchLineup[];
  tandas?: string;
  date?: string;
  notes?: string;
  availablePlayers?: string[]; // Array of player IDs available for this leg
}

/** A tie = enfrentamiento entre dos equipos (1 o 2 partidos) */
export interface PlayoffTie {
  id: string;
  roundId: string;
  homeTeam: string;   // nuestro equipo name or opponent name
  awayTeam: string;
  seedHome?: number;  // clasificación (para desempate)
  seedAway?: number;
  legFormat: PlayoffLegFormat;
  legs: PlayoffLeg[]; // 1 leg for SINGLE, up to 2 for HOME_AWAY
  winnerId?: string;  // 'home' | 'away' | null (pending)
  notes?: string;
}

/** A round = una ronda del playoff (Cuartos, Semis, Final…) */
export interface PlayoffRound {
  id: string;
  name: string;       // e.g. "Cuartos de Final"
  order: number;      // 1 = first round
  legFormat: PlayoffLegFormat;
  ties: PlayoffTie[];
}

/** Top-level playoff bracket, attached to a season */
export interface PlayoffBracket {
  id: string;
  seasonId: string;
  name: string;       // e.g. "Playoff Ascenso"
  rounds: PlayoffRound[];
  createdAt: string;
}

export interface UserSession {
  role: 'CAPTAIN' | 'GUEST';
  isAuthenticated: boolean;
}
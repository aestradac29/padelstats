

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
}

export type ViewState = 'LOGIN' | 'DASHBOARD' | 'PLAYERS' | 'MATCHES' | 'LINEUP' | 'SETTINGS' | 'QUICK_LINEUP' | 'PAIRS';

export interface UserSession {
  role: 'CAPTAIN' | 'GUEST';
  isAuthenticated: boolean;
}
import { Season, TeamSettings, ScoringRange } from "../types";

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

export const CATEGORIES_MASCULINO = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª'] as const;
export const CATEGORIES_FEMENINO  = ['1ª F', '2ª F', '3ª F', '4ª F', '5ª F', '6ª F'] as const;

/** Map category label → PRESET_RANGES key */
export const CATEGORY_TO_RANGE_KEY: Record<string, string> = {
  '1ª': '1ª', '2ª': '2ª', '3ª': '3ª', '4ª': '4ª', '5ª': '5ª', '6ª': '6ª',
  '1ª F': '1ª', '2ª F': '2ª', '3ª F': '3ª', '4ª F': '4ª', '5ª F': '5ª', '6ª F': '6ª',
};

export const PRESET_RANGES: Record<string, ScoringRange[]> = {
  '1ª': [
    { min: 5281, max: 9999, win: 55, loss: 275 },
    { min: 4291, max: 5280, win: 110, loss: 220 },
    { min: 3301, max: 4290, win: 138, loss: 193 },
    { min: 2311, max: 3300, win: 193, loss: 138 },
    { min: 1320, max: 2310, win: 220, loss: 110 },
    { min: 0, max: 1319, win: 275, loss: 55 },
  ],
  '2ª': [
    { min: 3361, max: 9999, win: 35, loss: 175 },
    { min: 2731, max: 3360, win: 70, loss: 140 },
    { min: 2101, max: 2730, win: 88, loss: 123 },
    { min: 1471, max: 2100, win: 123, loss: 88 },
    { min: 840, max: 1470, win: 140, loss: 70 },
    { min: 0, max: 839, win: 175, loss: 35 },
  ],
  '3ª': [
     { min: 2081, max: 9999, win: 22, loss: 108 },
     { min: 1691, max: 2080, win: 43, loss: 87 },
     { min: 1301, max: 1690, win: 54, loss: 76 },
     { min: 911, max: 1300, win: 76, loss: 54 },
     { min: 520, max: 910, win: 87, loss: 43 },
     { min: 0, max: 519, win: 108, loss: 22 },
  ],
  '4ª': [
     { min: 1281, max: 9999, win: 13, loss: 67 },
     { min: 1041, max: 1280, win: 27, loss: 53 },
     { min: 801, max: 1040, win: 33, loss: 47 },
     { min: 561, max: 800, win: 47, loss: 33 },
     { min: 320, max: 560, win: 53, loss: 27 },
     { min: 0, max: 319, win: 67, loss: 13 },
  ],
  '5ª': [
     { min: 801, max: 9999, win: 8, loss: 42 },
     { min: 651, max: 800, win: 17, loss: 33 },
     { min: 501, max: 650, win: 21, loss: 29 },
     { min: 351, max: 500, win: 29, loss: 21 },
     { min: 200, max: 350, win: 33, loss: 17 },
     { min: 0, max: 199, win: 42, loss: 8 },
  ],
  '6ª': [
     { min: 481, max: 9999, win: 5, loss: 20 },
     { min: 391, max: 480, win: 10, loss: 18 },
     { min: 301, max: 390, win: 14, loss: 16 },
     { min: 211, max: 300, win: 16, loss: 14 },
     { min: 120, max: 210, win: 18, loss: 10 },
     { min: 0, max: 119, win: 20, loss: 5 },
  ]
};

export const DEFAULT_SETTINGS: TeamSettings = {
  scoringSystem: 'NONE',
  pointsPerWin: 3,
  pointsPerDraw: 1,
  pointsPerLoss: 0,
  pointsAttendance: 1,
  ranges: PRESET_RANGES['6ª']
};

export const DEFAULT_SEASON: Season = {
    id: 'default',
    name: 'Temporada General',
    isActive: true,
    settings: DEFAULT_SETTINGS,
    playerStartPoints: {}
};

export const TANDA_OPTIONS = [
    // Masculino (5 partidos)
    { value: '5', label: '5 (Turno único) - Masculino' },
    { value: '4-1', label: '4 - 1 (Dos turnos) - Masculino' },
    { value: '1-4', label: '1 - 4 (Dos turnos) - Masculino' },
    { value: '3-2', label: '3 - 2 (Dos turnos) - Masculino' },
    { value: '2-3', label: '2 - 3 (Dos turnos) - Masculino' },
    { value: '2-2-1', label: '2 - 2 - 1 (Tres turnos) - Masculino' },
    { value: '1-2-2', label: '1 - 2 - 2 (Tres turnos) - Masculino' },
    { value: '2-1-2', label: '2 - 1 - 2 (Tres turnos) - Masculino' },
    // Femenino (4 partidos)
    { value: '4', label: '4 (Turno único) - Femenino' },
    { value: '3-1', label: '3 - 1 (Dos turnos) - Femenino' },
    { value: '1-3', label: '1 - 3 (Dos turnos) - Femenino' },
    { value: '2-2', label: '2 - 2 (Dos turnos) - Femenino' },
    { value: '2-1-1', label: '2 - 1 - 1 (Tres turnos) - Femenino' },
    { value: '1-2-1', label: '1 - 2 - 1 (Tres turnos) - Femenino' },
    { value: '1-1-2', label: '1 - 1 - 2 (Tres turnos) - Femenino' },
];
import { Season, TeamSettings } from "../types";

export const DEFAULT_SETTINGS: TeamSettings = {
  scoringSystem: 'SIMPLE',
  pointsPerWin: 3,
  pointsPerDraw: 1,
  pointsPerLoss: 0,
  pointsAttendance: 1,
  ranges: [
    { min: 1281, max: 9999, win: 13, loss: 67 },
    { min: 1041, max: 1280, win: 27, loss: 53 },
    { min: 801, max: 1040, win: 33, loss: 47 },
    { min: 561, max: 800, win: 47, loss: 33 },
    { min: 320, max: 560, win: 53, loss: 27 },
    { min: 0, max: 319, win: 67, loss: 13 },
  ]
};

export const DEFAULT_SEASON: Season = {
    id: 'default',
    name: 'Temporada General',
    isActive: true,
    settings: DEFAULT_SETTINGS,
    playerStartPoints: {}
};

export const TANDA_OPTIONS = [
    { value: '5', label: '5 (Turno único)' },
    { value: '4-1', label: '4 - 1 (Dos turnos)' },
    { value: '1-4', label: '1 - 4 (Dos turnos)' },
    { value: '3-2', label: '3 - 2 (Dos turnos)' },
    { value: '2-3', label: '2 - 3 (Dos turnos)' },
    { value: '2-2-1', label: '2 - 2 - 1 (Tres turnos)' },
    { value: '1-2-2', label: '1 - 2 - 2 (Tres turnos)' },
    { value: '2-1-2', label: '2 - 1 - 2 (Tres turnos)' },
];
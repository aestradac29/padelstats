

import React, { useState, useEffect } from 'react';
import {
    Users, Trophy, Calendar, Settings, LogOut, LayoutGrid, ChevronRight, ChevronDown, X, Camera, Edit2, Trash2, Plus, Menu, Wand2, Upload, ImageIcon, Sparkles, Shield, Check, UserPlus, List, Sun, Moon, Activity
} from './components/Icons';
import {
    Player, AppState, ViewState, Position, MatchDay, MatchLineup, MatchResult
} from './types';
import {
    auth,
    logoutUser,
    createTeam,
    subscribeToTeam,
    getTeamIdForUser,
    updateTeamData
} from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

// New Imports
import { DEFAULT_SETTINGS, DEFAULT_SEASON, TANDA_OPTIONS } from './utils/constants';
import { compressImage, recalculateStats, formatDate } from './utils/helpers';
import { Button, Input, Select, Checkbox, PadelLogo } from './components/UIComponents';
import { extractScheduleFromImage, parseMatchDetailsFromText } from './services/geminiService';

// Views
import LoginView from './components/views/LoginView';
import DashboardView from './components/views/DashboardView';
import PlayersView from './components/views/PlayersView';
import MatchesView from './components/views/MatchesView';
import LineupView from './components/views/LineupView';
import SettingsView from './components/views/SettingsView';
import QuickLineupView from './components/views/QuickLineupView';
import PairsView from './components/views/PairsView';

const App = () => {
    // --- Global State ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [teamId, setTeamId] = useState<string | null>(null);
    const [checkingTeam, setCheckingTeam] = useState(true);
    const [data, setData] = useState<AppState | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Theme State
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark' ||
                (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });

    // --- UI State ---
    const [currentView, setCurrentView] = useState<ViewState>('LOGIN');
    const [sessionRole, setSessionRole] = useState<'CAPTAIN' | 'GUEST'>('GUEST');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Season State
    const [viewSeasonId, setViewSeasonId] = useState<string>('all');

    // --- Modal/Form State ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'ADD_PLAYER' | 'EDIT_PLAYER' | 'ADD_MATCH' | 'EDIT_MATCH' | 'EDIT_TEAM' | 'GENERATE_CALENDAR'>('ADD_PLAYER');
    const [importMode, setImportMode] = useState<'MANUAL' | 'BULK'>('MANUAL');
    const [calendarMode, setCalendarMode] = useState<'PATTERN' | 'IMAGE'>('PATTERN');
    const [matchToDelete, setMatchToDelete] = useState<MatchDay | null>(null);

    // Temporary State for Forms
    const [tempPlayer, setTempPlayer] = useState<Partial<Player>>({});
    const [tempTeamName, setTempTeamName] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [tempPlayersList, setTempPlayersList] = useState<Partial<Player>[]>([]);
    const [tempMatch, setTempMatch] = useState<Partial<MatchDay>>({
        date: new Date().toISOString(),
        opponent: '',
        isHome: true,
        lineups: [],
        tandas: '5',
        availablePlayers: [],
        ignorePoints: false
    });

    // Match Import State
    const [showMatchTextImport, setShowMatchTextImport] = useState(false);
    const [matchImportText, setMatchImportText] = useState('');
    const [isProcessingText, setIsProcessingText] = useState(false);

    // Guest/Filial Add State
    const [isAddingGuest, setIsAddingGuest] = useState(false);
    const [guestName, setGuestName] = useState('');

    // Calendar Generator State
    const [genStartDate, setGenStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [genStartTime, setGenStartTime] = useState('20:00');
    const [genInterval, setGenInterval] = useState(7); // Days
    const [genOpponents, setGenOpponents] = useState('');
    const [genHomeAway, setGenHomeAway] = useState<'ALTERNATE' | 'HOME' | 'AWAY'>('ALTERNATE');
    const [genDoubleRound, setGenDoubleRound] = useState(false);

    // Calendar Image State
    const [calendarImage, setCalendarImage] = useState<string | null>(null);
    const [myClubName, setMyClubName] = useState('');
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [previewMatches, setPreviewMatches] = useState<Partial<MatchDay>[]>([]);

    const [tempLineupScores, setTempLineupScores] = useState({
        player1Id: '', player2Id: '',
        opponent1Name: '', opponent2Name: '',
        s1We: '', s1They: '',
        s2We: '', s2They: '',
        s3We: '', s3They: '',
        pairNumber: ''
    });

    // --- Initialization & Auth Listener ---
    useEffect(() => {
        // Theme initialization
        if (darkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                setCheckingTeam(true);
                const tid = await getTeamIdForUser(user.uid);
                if (tid) {
                    setTeamId(tid);
                    setSessionRole('CAPTAIN');
                    setCurrentView('DASHBOARD');
                } else {
                    setTeamId(null);
                }
                setCheckingTeam(false);
            } else {
                setTeamId(null);
                setData(null);
                setCurrentView('LOGIN');
                setCheckingTeam(false);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [darkMode]);

    // --- Real-time Data Subscription ---
    useEffect(() => {
        if (teamId) {
            const unsubscribe = subscribeToTeam(teamId, (teamData) => {
                if (teamData) {
                    if (!teamData.seasons || teamData.seasons.length === 0) {
                        teamData.seasons = [DEFAULT_SEASON];
                    }
                    setData(teamData);

                    if (viewSeasonId === 'all') {
                        const active = teamData.seasons?.find(s => s.isActive);
                        if (active) setViewSeasonId(active.id);
                        else if (teamData.seasons && teamData.seasons.length > 0) setViewSeasonId(teamData.seasons[0].id);
                        else setViewSeasonId('default');
                    }

                    // Migration for pairNumber
                    teamData.matches?.forEach(match => {
                        match.lineups?.forEach((lineup, index) => {
                            if (lineup.pairNumber === undefined) {
                                lineup.pairNumber = index + 1;
                            }
                        });
                    });

                } else {
                    console.error("Team document not found");
                }
            });
            return () => unsubscribe();
        }
    }, [teamId]);

    // --- Actions ---

    const toggleTheme = () => setDarkMode(!darkMode);

    const handleLogout = async () => {
        await logoutUser();
        setSessionRole('GUEST');
        setTeamId(null);
        setData(null);
        setCheckingTeam(false);
        setIsMobileMenuOpen(false);
    };

    const handleCreateTeam = async (name: string) => {
        if (!currentUser) return;
        try {
            setIsLoading(true);
            const newTeamId = await createTeam(currentUser, name, DEFAULT_SETTINGS);
            setTeamId(newTeamId);
            setSessionRole('CAPTAIN');
            setCurrentView('DASHBOARD');
        } catch (e) {
            console.error(e);
            alert("Error creando equipo");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateTeamName = async () => {
        if (!teamId || !tempTeamName) return;
        await updateTeamData(teamId, { teamName: tempTeamName });
        setIsModalOpen(false);
    };

    const handleGuestLogin = (guestTeamId: string) => {
        if (!guestTeamId) return;
        setTeamId(guestTeamId);
        setSessionRole('GUEST');
        setCurrentView('DASHBOARD');
    };

    const createPlayerObject = (p: Partial<Player>): Player => {
        // Safely construct player to avoid undefined values which Firebase rejects
        const newPlayer: Player = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: p.name || 'Nuevo Jugador',
            surname: p.surname || '', // Keep existing surname if provided (e.g. for Guests)
            position: p.position || Position.AMBOS,
            level: 3.0,
            initialPoints: Number(p.initialPoints) || 0,
            handedness: p.handedness || 'right',
            matchesPlayed: 0,
            wins: 0,
            email: ''
        };

        // Only add photoUrl if it exists to avoid undefined
        if (p.photoUrl) {
            newPlayer.photoUrl = p.photoUrl;
        }

        return newPlayer;
    };

    const addPlayer = async (player: Partial<Player>) => {
        if (!data || !teamId) return;
        const newPlayer = createPlayerObject(player);

        if (viewSeasonId !== 'all' && viewSeasonId !== 'default') {
            const updatedSeasons = [...(data.seasons || [])];
            const seasonIndex = updatedSeasons.findIndex(s => s.id === viewSeasonId);
            if (seasonIndex >= 0) {
                const points = Number(player.initialPoints) || 0;
                updatedSeasons[seasonIndex] = {
                    ...updatedSeasons[seasonIndex],
                    playerStartPoints: {
                        ...(updatedSeasons[seasonIndex].playerStartPoints || {}),
                        [newPlayer.id]: points
                    }
                };
                await updateTeamData(teamId, { seasons: updatedSeasons });
            }
        }

        const updatedPlayers = [...data.players, newPlayer];
        await updateTeamData(teamId, { players: updatedPlayers });
        setIsModalOpen(false);
    };

    // NEW FUNCTION: Quick Add Guest from Match Modal (No Prompt)
    const confirmAddGuest = async () => {
        if (!data || !teamId || !guestName.trim()) return;

        const newPlayer = createPlayerObject({
            name: guestName.trim(),
            surname: '(Filial)',
            initialPoints: 0,
            position: Position.AMBOS
        });

        // 1. Optimistic Update (Immediate UI Refresh)
        const updatedPlayers = [...data.players, newPlayer];
        setData(prev => prev ? ({ ...prev, players: updatedPlayers }) : null);

        // 2. Add to Current Match Availability
        setTempMatch(prev => ({
            ...prev,
            availablePlayers: [...(prev.availablePlayers || []), newPlayer.id]
        }));

        // 3. Persist to DB
        await updateTeamData(teamId, { players: updatedPlayers });

        // Reset
        setGuestName('');
        setIsAddingGuest(false);
    };

    const addPlayersBulk = async () => {
        if (!data || !teamId || tempPlayersList.length === 0) return;
        const newPlayers = tempPlayersList.map(p => createPlayerObject(p));

        if (viewSeasonId !== 'all' && viewSeasonId !== 'default') {
            const updatedSeasons = [...(data.seasons || [])];
            const seasonIndex = updatedSeasons.findIndex(s => s.id === viewSeasonId);
            if (seasonIndex >= 0) {
                const newPointsMap = { ...(updatedSeasons[seasonIndex].playerStartPoints || {}) };
                newPlayers.forEach(p => {
                    newPointsMap[p.id] = p.initialPoints || 0;
                });
                updatedSeasons[seasonIndex] = {
                    ...updatedSeasons[seasonIndex],
                    playerStartPoints: newPointsMap
                };
                await updateTeamData(teamId, { seasons: updatedSeasons });
            }
        }

        const updatedPlayers = [...data.players, ...newPlayers];
        await updateTeamData(teamId, { players: updatedPlayers });
        setIsModalOpen(false);
        setTempPlayersList([]);
        setBulkText('');
    };

    const updatePlayer = async (player: Partial<Player>) => {
        if (!data || !teamId) return;
        // Sanitize update to prevent undefined fields
        const sanitizedPlayer = { ...player };
        if (!sanitizedPlayer.surname) sanitizedPlayer.surname = '';

        const updatedPlayers = data.players.map(p => p.id === player.id ? { ...p, ...sanitizedPlayer } as Player : p);

        if (viewSeasonId !== 'all' && modalType === 'EDIT_PLAYER' && player.id) {
            const updatedSeasons = [...(data.seasons || [])];
            const seasonIndex = updatedSeasons.findIndex(s => s.id === viewSeasonId);
            if (seasonIndex >= 0) {
                const points = Number(player.initialPoints) || 0;
                updatedSeasons[seasonIndex] = {
                    ...updatedSeasons[seasonIndex],
                    playerStartPoints: {
                        ...(updatedSeasons[seasonIndex].playerStartPoints || {}),
                        [player.id]: points
                    }
                };
                await updateTeamData(teamId, { players: updatedPlayers, seasons: updatedSeasons });
                setIsModalOpen(false);
                return;
            }
        }
        await updateTeamData(teamId, { players: updatedPlayers });
        setIsModalOpen(false);
    };

    const deletePlayer = async (id: string) => {
        if (!data || !teamId) return;
        if (window.confirm('¿Seguro que quieres eliminar a este jugador?')) {
            const updatedPlayers = data.players.filter(p => p.id !== id);
            await updateTeamData(teamId, { players: updatedPlayers });
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const compressed = await compressImage(file);
            setTempPlayer(prev => ({ ...prev, photoUrl: compressed }));
        } catch (err) {
            alert("Error subiendo imagen");
        }
    };

    // --- CALENDAR IMAGE HANDLING ---
    const handleCalendarImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            // Use high quality for OCR
            const compressed = await compressImage(file);
            setCalendarImage(compressed);
            setPreviewMatches([]);
        } catch (err) {
            alert("Error cargando imagen");
        }
    };

    const analyzeCalendarImage = async () => {
        if (!calendarImage) return;
        setIsAnalyzingImage(true);
        try {
            const matches = await extractScheduleFromImage(calendarImage, myClubName);
            setPreviewMatches(matches);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsAnalyzingImage(false);
        }
    };

    // --- MATCH TEXT PARSING ---
    const handleMatchTextImport = async () => {
        if (!data || !matchImportText.trim()) return;
        setIsProcessingText(true);
        try {
            const result = await parseMatchDetailsFromText(matchImportText, data.players);

            // Merge result with tempMatch
            setTempMatch(prev => ({
                ...prev,
                ...result,
                // Ensure we combine available players if any found
                availablePlayers: [
                    ...(prev.availablePlayers || []),
                    ...(result.availablePlayers || [])
                ]
            }));

            setMatchImportText('');
            setShowMatchTextImport(false);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsProcessingText(false);
        }
    };

    const saveImportedMatches = async () => {
        if (!data || !teamId || previewMatches.length === 0) return;
        const activeSeason = data.seasons?.find(s => s.isActive) || DEFAULT_SEASON;

        // Add SeasonID to imported matches
        const matchesToSave: MatchDay[] = previewMatches.map(m => ({
            ...m,
            id: m.id || Date.now().toString() + Math.random().toString(),
            seasonId: activeSeason.id,
            lineups: [],
            tandas: '5',
            availablePlayers: [],
            isHome: m.isHome ?? true,
            date: m.date || new Date().toISOString(),
            opponent: m.opponent || 'Desconocido',
            ignorePoints: false
        } as MatchDay));

        const updatedMatches = [...data.matches, ...matchesToSave];
        const updatedPlayers = recalculateStats(data.players, updatedMatches);
        await updateTeamData(teamId, { matches: updatedMatches, players: updatedPlayers });

        // Cleanup
        setCalendarImage(null);
        setPreviewMatches([]);
        setIsModalOpen(false);
    };

    const deleteMatch = (id: string) => {
        const m = data?.matches.find(match => match.id === id);
        if (m) setMatchToDelete(m);
    };

    const executeDeleteMatch = async () => {
        if (!data || !teamId || !matchToDelete) return;

        // Sanitize helper to remove undefined fields which Firestore rejects
        const sanitize = (obj: any) => JSON.parse(JSON.stringify(obj));

        try {
            const updatedMatches = data.matches.filter(m => m.id !== matchToDelete.id);
            const updatedPlayers = recalculateStats(data.players, updatedMatches);

            await updateTeamData(teamId, sanitize({ matches: updatedMatches, players: updatedPlayers }));
            setMatchToDelete(null);
        } catch (e) {
            console.error("Error deleting match:", e);
            alert("Error al eliminar la jornada. Inténtalo de nuevo.");
        }
    };

    const saveMatch = async () => {
        if (!data || !teamId) return;
        const activeSeason = data.seasons?.find(s => s.isActive) || DEFAULT_SEASON;

        // Force lineup players to be in available list to avoid contradictions
        const lineupPlayerIds = (tempMatch.lineups || []).flatMap(l => [l.player1Id, l.player2Id].filter(Boolean));
        const finalAvailablePlayers = Array.from(new Set([...(tempMatch.availablePlayers || []), ...lineupPlayerIds]));

        const newMatchData: MatchDay = {
            id: tempMatch.id || Date.now().toString(),
            date: tempMatch.date || new Date().toISOString(),
            opponent: tempMatch.opponent || 'Desconocido',
            isHome: tempMatch.isHome ?? true,
            lineups: tempMatch.lineups || [],
            notes: tempMatch.notes || undefined,
            tandas: tempMatch.tandas || '5',
            seasonId: tempMatch.seasonId || activeSeason.id,
            availablePlayers: finalAvailablePlayers,
            isRestDay: tempMatch.isRestDay || false,
            ignorePoints: tempMatch.ignorePoints || false
        };

        // Sanitize before saving
        const sanitize = (obj: any) => JSON.parse(JSON.stringify(obj));

        let updatedMatches;
        if (modalType === 'EDIT_MATCH') {
            updatedMatches = data.matches.map(m => m.id === newMatchData.id ? newMatchData : m);
        } else {
            updatedMatches = [...data.matches, newMatchData];
        }
        const updatedPlayers = recalculateStats(data.players, updatedMatches);

        try {
            await updateTeamData(teamId, sanitize({ matches: updatedMatches, players: updatedPlayers }));
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            alert("Error guardando jornada.");
        }
    };

    // Availability Helpers
    const toggleAvailability = (playerId: string) => {
        setTempMatch(prev => {
            const current = prev.availablePlayers || [];
            if (current.includes(playerId)) {
                return { ...prev, availablePlayers: current.filter(id => id !== playerId) };
            } else {
                return { ...prev, availablePlayers: [...current, playerId] };
            }
        });
    };

    const setAllAvailability = (available: boolean) => {
        if (!data) return;
        setTempMatch(prev => ({
            ...prev,
            availablePlayers: available ? data.players.map(p => p.id) : []
        }));
    };

    const handleGenerateCalendar = async () => {
        if (!data || !teamId) return;

        // 1. Parse opponents
        const opponents = genOpponents.split('\n').map(s => s.trim()).filter(Boolean);
        if (opponents.length === 0) {
            alert("Introduce al menos un rival.");
            return;
        }

        const activeSeason = data.seasons?.find(s => s.isActive) || DEFAULT_SEASON;
        const newMatches: MatchDay[] = [];
        let currentDate = new Date(`${genStartDate}T${genStartTime}`);

        // Helper to create a match
        const createMatch = (opponent: string, isHome: boolean, idSuffix: string) => {
            return {
                id: Date.now().toString() + idSuffix,
                date: currentDate.toISOString(),
                opponent: opponent,
                isHome: isHome,
                lineups: [],
                tandas: '5',
                seasonId: activeSeason.id,
                availablePlayers: [],
                ignorePoints: false
            };
        };

        // First Round Loop
        opponents.forEach((opp, index) => {
            let isHome = true;
            if (genHomeAway === 'HOME') isHome = true;
            else if (genHomeAway === 'AWAY') isHome = false;
            else isHome = index % 2 === 0; // Alternate

            newMatches.push(createMatch(opp, isHome, `_${index}`));

            // Increment date for next match
            currentDate.setDate(currentDate.getDate() + Number(genInterval));
        });

        // Second Round Loop (Optional)
        if (genDoubleRound) {
            opponents.forEach((opp, index) => {
                // Find the first match against this opponent to reverse home/away
                // But for simple "Return" leg, we just reverse the logic of the first loop
                let isHomeFirstLeg = true;
                if (genHomeAway === 'HOME') isHomeFirstLeg = true;
                else if (genHomeAway === 'AWAY') isHomeFirstLeg = false;
                else isHomeFirstLeg = index % 2 === 0;

                newMatches.push(createMatch(opp, !isHomeFirstLeg, `_return_${index}`));
                currentDate.setDate(currentDate.getDate() + Number(genInterval));
            });
        }

        const updatedMatches = [...data.matches, ...newMatches];
        const updatedPlayers = recalculateStats(data.players, updatedMatches);

        // Sanitize before saving
        const sanitize = (obj: any) => JSON.parse(JSON.stringify(obj));

        await updateTeamData(teamId, sanitize({ matches: updatedMatches, players: updatedPlayers }));

        // Reset and Close
        setGenOpponents('');
        setIsModalOpen(false);
    };

    const addLineupToTempMatch = () => {
        const { player1Id, player2Id, s1We, s1They, s2We, s2They, s3We, s3They, opponent1Name, opponent2Name, pairNumber } = tempLineupScores;
        if (!player1Id || !player2Id) {
            alert("Selecciona dos jugadores");
            return;
        }
        const calculateSetWinner = (left: string, right: string, isHome: boolean) => {
            const l = Number(left);
            const r = Number(right);
            if (isHome) {
                if (l > r) return 'win';
                if (l < r) return 'loss';
                return 'draw';
            } else {
                if (r > l) return 'win';
                if (r < l) return 'loss';
                return 'draw';
            }
        }
        let setsWon = 0;
        let setsLost = 0;
        const r1 = calculateSetWinner(s1We, s1They, tempMatch.isHome ?? true);
        if (r1 === 'win') setsWon++; else if (r1 === 'loss') setsLost++;
        const r2 = calculateSetWinner(s2We, s2They, tempMatch.isHome ?? true);
        if (r2 === 'win') setsWon++; else if (r2 === 'loss') setsLost++;
        if (s3We && s3They) {
            const r3 = calculateSetWinner(s3We, s3They, tempMatch.isHome ?? true);
            if (r3 === 'win') setsWon++; else if (r3 === 'loss') setsLost++;
        }
        let result = MatchResult.DRAW;
        if (setsWon > setsLost) result = MatchResult.WIN;
        else if (setsLost > setsWon) result = MatchResult.LOSS;
        const newLineup: MatchLineup = {
            player1Id,
            player2Id,
            opponent1Name: opponent1Name || undefined,
            opponent2Name: opponent2Name || undefined,
            set1: `${s1We}-${s1They}`,
            set2: `${s2We}-${s2They}`,
            result,
            pairNumber: pairNumber ? Number(pairNumber) : undefined
        };
        if (s3We && s3They) {
            newLineup.set3 = `${s3We}-${s3They}`;
        }
        setTempMatch(prev => ({
            ...prev,
            lineups: [...(prev.lineups || []), newLineup]
        }));
        setTempLineupScores({
            player1Id: '', player2Id: '',
            opponent1Name: '', opponent2Name: '',
            s1We: '', s1They: '',
            s2We: '', s2They: '',
            s3We: '', s3They: '',
            pairNumber: ''
        });
    };

    const removeLineupFromTempMatch = (index: number) => {
        setTempMatch(prev => ({
            ...prev,
            lineups: prev.lineups?.filter((_, i) => i !== index)
        }));
    };

    const editLineupInTempMatch = (index: number) => {
        if (!tempMatch.lineups) return;
        const lineup = tempMatch.lineups[index];
        const [s1We, s1They] = (lineup.set1 || "0-0").split('-');
        const [s2We, s2They] = (lineup.set2 || "0-0").split('-');
        let s3We = '', s3They = '';
        if (lineup.set3) {
            [s3We, s3They] = lineup.set3.split('-');
        }
        setTempLineupScores({
            player1Id: lineup.player1Id,
            player2Id: lineup.player2Id,
            opponent1Name: lineup.opponent1Name || '',
            opponent2Name: lineup.opponent2Name || '',
            s1We: s1We || '', s1They: s1They || '',
            s2We: s2We || '', s2They: s2They || '',
            s3We: s3We || '', s3They: s3They || '',
            pairNumber: lineup.pairNumber?.toString() || ''
        });
        removeLineupFromTempMatch(index);
    };

    const handleBulkTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setBulkText(text);
        const lines = text.split(/\r?\n/);
        const parsedPlayers: Partial<Player>[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let tempLine = trimmed;
            let position = Position.AMBOS;
            let handedness: 'right' | 'left' = 'right';
            let initialPoints = 0;

            // 1. Extract Points (look for standalone numbers)
            const pointsMatch = tempLine.match(/\b\d+(\.\d+)?\b/);
            if (pointsMatch) {
                const val = Number(pointsMatch[0]);
                if (!isNaN(val)) {
                    initialPoints = val;
                    tempLine = tempLine.replace(pointsMatch[0], '');
                }
            }

            // 2. Extract Position (insensitive)
            if (/\b(drive|derecha)\b/i.test(tempLine)) {
                position = Position.DRIVE;
                tempLine = tempLine.replace(/\b(drive|derecha)\b/i, '');
            } else if (/\b(reves|revés|back|backhand)\b/i.test(tempLine)) {
                position = Position.REVES;
                tempLine = tempLine.replace(/\b(reves|revés|back|backhand)\b/i, '');
            }

            // 3. Extract Handedness
            if (/\b(zurdo|zurda|left|izq)\b/i.test(tempLine)) {
                handedness = 'left';
                tempLine = tempLine.replace(/\b(zurdo|zurda|left|izq)\b/i, '');
            } else if (/\b(diestro|diestra|right|der)\b/i.test(tempLine)) {
                handedness = 'right';
                tempLine = tempLine.replace(/\b(diestro|diestra|right|der)\b/i, '');
            }

            // 4. Cleanup Name
            let name = tempLine.replace(/[,;\t-]/g, ' ').replace(/\s+/g, ' ').trim();
            name = name.replace(/\b(puntos|pts|ptos)\b/i, '').trim();

            if (name) {
                parsedPlayers.push({ name, position, handedness, initialPoints });
            }
        }
        setTempPlayersList(parsedPlayers);
    };

    const NavContent = () => (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Logo & team info */}
            <div className="p-6 pb-4 border-b border-blue-900/60">
                <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-900/60 p-2 rounded-xl border border-blue-800/50">
                        <PadelLogo className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-white font-black text-base tracking-tight leading-none">Padel Stats</h1>
                        <p className="text-blue-400 text-xs font-medium mt-0.5">Pro</p>
                    </div>
                </div>
                {data && (
                    <div className="bg-blue-900/40 rounded-xl px-3 py-2.5 border border-blue-800/40">
                        <p className="text-white font-bold text-sm truncate leading-tight">{data.teamName}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md ${sessionRole === 'CAPTAIN' ? 'bg-lime-400/20 text-lime-300 border border-lime-500/30' : 'bg-blue-800 text-blue-300 border border-blue-700'}`}>
                                {sessionRole === 'CAPTAIN' ? '⚡ Capitán' : '👁 Invitado'}
                            </span>
                            {data.captainName && <span className="text-blue-400 text-[10px] truncate">{data.captainName}</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* Season selector */}
            {data && data.seasons && data.seasons.length > 0 && (
                <div className="px-4 py-3 border-b border-blue-900/60">
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 block">Temporada</label>
                    <div className="relative">
                        <select
                            style={{ backgroundColor: 'rgba(30,58,138,0.6)', color: 'white', appearance: 'none', MozAppearance: 'none', WebkitAppearance: 'none' }}
                            value={viewSeasonId}
                            onChange={(e) => setViewSeasonId(e.target.value)}
                            className="w-full font-bold text-sm py-2.5 px-3 pr-8 rounded-xl appearance-none border border-blue-800/60 outline-none focus:ring-2 focus:ring-lime-400 transition-all [color-scheme:dark]"
                        >
                            <option value="all">Todas las temporadas</option>
                            {data.seasons.map(s => (
                                <option key={s.id} value={s.id}>{s.name}{s.isActive ? ' ●' : ''}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 pointer-events-none" size={16} />
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
                {[
                    { id: 'DASHBOARD', label: 'Inicio', icon: Trophy },
                    { id: 'PLAYERS', label: 'Plantilla', icon: Users },
                    { id: 'MATCHES', label: 'Jornadas', icon: Calendar },
                    { id: 'LINEUP', label: 'Alineación', icon: LayoutGrid },
                    { id: 'QUICK_LINEUP', label: 'Alineación Rápida', icon: Sparkles },
                    { id: 'PAIRS', label: 'Análisis Parejas', icon: Activity },
                    { id: 'SETTINGS', label: 'Ajustes', icon: Settings, role: 'CAPTAIN' }
                ].map((item: any) => {
                    if (item.role && item.role !== sessionRole) return null;
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => { setCurrentView(item.id as ViewState); setIsMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group ${isActive ? 'bg-lime-400 text-blue-950 shadow-md shadow-lime-400/25' : 'text-slate-400 hover:bg-blue-900/60 hover:text-white'}`}
                        >
                            <item.icon size={18} className={isActive ? 'text-blue-950' : 'text-slate-500 group-hover:text-lime-400 transition-colors'} />
                            <span className="font-bold text-xs uppercase tracking-wider flex-1 text-left">{item.label}</span>
                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-900/50" />}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom actions */}
            <div className="p-4 border-t border-blue-900/60 space-y-1">
                <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-3 text-blue-400 hover:text-white hover:bg-blue-900/50 rounded-xl transition-all text-xs font-bold uppercase tracking-wide">
                    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                    <span>{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
                </button>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400/80 hover:text-red-300 hover:bg-red-900/10 rounded-xl transition-all text-xs font-black uppercase tracking-wide">
                    <LogOut size={16} /> Cerrar Sesión
                </button>
            </div>
        </div>
    );

    // --- View Rendering ---

    if (isLoading) return (
        <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center gap-4">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-900 border-t-lime-400 rounded-full animate-spin"/>
                <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-b-lime-400/30 rounded-full animate-spin" style={{animationDirection:'reverse', animationDuration:'1.5s'}}/>
            </div>
            <div className="text-center">
                <p className="text-white font-black text-lg tracking-tight">Padel <span className="text-lime-400">Stats</span></p>
                <p className="text-blue-400 text-xs font-medium mt-0.5 animate-pulse">Cargando...</p>
            </div>
        </div>
    );

    if (!teamId && !currentUser) {
        return <LoginView currentUser={currentUser} checkingTeam={checkingTeam} teamId={teamId} handleCreateTeam={handleCreateTeam} handleLogout={handleLogout} handleGuestLogin={handleGuestLogin} />;
    }
    if (currentUser && !teamId) {
        return <LoginView currentUser={currentUser} checkingTeam={checkingTeam} teamId={teamId} handleCreateTeam={handleCreateTeam} handleLogout={handleLogout} handleGuestLogin={handleGuestLogin} />;
    }

    // Calculate filtered options based on availability
    const availablePlayersForSelect = data?.players.filter(p => (tempMatch.availablePlayers || []).includes(p.id)) || [];
    const sortedAvailablePlayers = [...availablePlayersForSelect].sort((a, b) => a.name.localeCompare(b.name));
    const playerOptionsForSelect = [{ label: '...', value: '' }, ...sortedAvailablePlayers.map(p => ({ label: `${p.name} ${p.surname || ''}`, value: p.id }))];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row text-slate-900 dark:text-slate-100 transition-colors duration-200">

            {/* Mobile Top Bar */}
            <div className="md:hidden bg-blue-950 px-4 py-3 flex justify-between items-center text-white z-30 sticky top-0 border-b border-blue-900/60">
                <div className="flex items-center gap-2.5">
                    <PadelLogo className="w-7 h-7" />
                    <div>
                        <h1 className="font-black text-sm uppercase tracking-tight leading-none text-white">Padel Stats</h1>
                        {data && <p className="text-[10px] text-blue-400 font-medium leading-none mt-0.5 truncate max-w-[140px]">{data.teamName}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {data && data.seasons && data.seasons.length > 0 && (
                        <select
                            style={{ backgroundColor: 'transparent', color: '#93c5fd', appearance: 'none', fontSize: '11px' }}
                            value={viewSeasonId}
                            onChange={(e) => setViewSeasonId(e.target.value)}
                            className="font-bold py-1 px-2 rounded-lg border border-blue-800 outline-none max-w-[110px] truncate [color-scheme:dark]"
                        >
                            <option value="all">Todas</option>
                            {data.seasons.map(s => (
                                <option key={s.id} value={s.id}>{s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name}</option>
                            ))}
                        </select>
                    )}
                    <button onClick={toggleTheme} className="p-2 text-blue-300 hover:text-white transition-colors">
                        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-blue-300 hover:text-white transition-colors"><Menu size={20} /></button>
                </div>
            </div>

            {/* Mobile Menu Drawer (Overlay) */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
                    <aside className="relative bg-blue-950 text-slate-400 w-72 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                        <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-4 right-4 text-slate-400 p-2"><X size={24} /></button>
                        <NavContent />
                    </aside>
                </div>
            )}

            {/* Desktop Sidebar */}
            <aside className="hidden md:flex bg-blue-950 text-slate-400 w-72 flex-shrink-0 flex-col h-screen sticky top-0">
                <NavContent />
            </aside>

            <main className="flex-1 overflow-y-auto h-[calc(100vh-56px)] md:h-screen bg-slate-50 dark:bg-slate-950 relative scroll-smooth">
                <div className="max-w-6xl mx-auto pb-24 md:pb-0 p-4 md:p-10">
                    {currentView === 'DASHBOARD' && (
                        <DashboardView
                            data={data}
                            sessionRole={sessionRole}
                            viewSeasonId={viewSeasonId}
                            teamId={teamId}
                            setTempTeamName={setTempTeamName}
                            setModalType={setModalType}
                            setIsModalOpen={setIsModalOpen}
                            isDarkMode={darkMode}
                        />
                    )}
                    {currentView === 'PLAYERS' && (
                        <PlayersView
                            data={data}
                            sessionRole={sessionRole}
                            viewSeasonId={viewSeasonId}
                            setTempPlayer={setTempPlayer}
                            setModalType={setModalType}
                            setImportMode={setImportMode}
                            setIsModalOpen={setIsModalOpen}
                            deletePlayer={deletePlayer}
                            setTempPlayersList={setTempPlayersList}
                        />
                    )}
                    {currentView === 'MATCHES' && (
                        <MatchesView
                            data={data}
                            sessionRole={sessionRole}
                            viewSeasonId={viewSeasonId}
                            setTempMatch={setTempMatch}
                            setModalType={setModalType}
                            setIsModalOpen={setIsModalOpen}
                            deleteMatch={deleteMatch}
                        />
                    )}
                    {currentView === 'LINEUP' && (
                        <LineupView
                            data={data}
                            viewSeasonId={viewSeasonId}
                        />
                    )}
                    {currentView === 'QUICK_LINEUP' && (
                        <QuickLineupView />
                    )}
                    {currentView === 'PAIRS' && (
                        <PairsView
                            data={data}
                            viewSeasonId={viewSeasonId}
                        />
                    )}
                    {currentView === 'SETTINGS' && (
                        <SettingsView
                            data={data}
                            teamId={teamId}
                            viewSeasonId={viewSeasonId}
                            setViewSeasonId={setViewSeasonId}
                            sessionRole={sessionRole}
                            updateTeamData={updateTeamData}
                        />
                    )}
                </div>
            </main>

            {/* ===== MOBILE BOTTOM NAVIGATION BAR ===== */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/20">
                <div className="flex items-stretch justify-around px-1 pt-2 pb-safe-area-inset-bottom pb-2">
                    {[
                        { id: 'DASHBOARD', label: 'Inicio', icon: Trophy },
                        { id: 'PLAYERS', label: 'Plantilla', icon: Users },
                        { id: 'MATCHES', label: 'Jornadas', icon: Calendar },
                        { id: 'LINEUP', label: 'Alineación', icon: LayoutGrid },
                        { id: 'PAIRS', label: 'Parejas', icon: Activity },
                    ].map(item => {
                        const isActive = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setCurrentView(item.id as ViewState)}
                                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 px-1 rounded-xl transition-all duration-200 ${isActive ? 'text-blue-950 dark:text-blue-950' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                                <div className={`relative flex items-center justify-center w-9 h-7 rounded-xl transition-all duration-200 ${isActive ? 'bg-lime-400 shadow-sm shadow-lime-400/40' : 'bg-transparent'}`}>
                                    <item.icon size={18} className={isActive ? 'text-blue-950' : ''} />
                                    {isActive && (
                                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-lime-400 rounded-full border-2 border-white dark:border-slate-900" />
                                    )}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-wide leading-none ${isActive ? 'text-blue-700 dark:text-blue-600' : ''}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                    {/* More button for QUICK_LINEUP and SETTINGS */}
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 px-1 rounded-xl transition-all duration-200 ${['QUICK_LINEUP', 'SETTINGS'].includes(currentView) ? 'text-blue-950' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                        <div className={`flex items-center justify-center w-9 h-7 rounded-xl transition-all duration-200 ${['QUICK_LINEUP', 'SETTINGS'].includes(currentView) ? 'bg-lime-400 shadow-sm' : 'bg-transparent'}`}>
                            <Menu size={18} className={['QUICK_LINEUP', 'SETTINGS'].includes(currentView) ? 'text-blue-950' : ''} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wide leading-none">Más</span>
                    </button>
                </div>
            </nav>

            {/* --- CONFIRMATION MODAL FOR DELETING MATCH --- */}
            {matchToDelete && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-center">
                        <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Shield className="text-red-500" size={24} />
                        </div>
                        <h4 className="text-slate-900 dark:text-white font-black text-xl mb-2">¿Eliminar Jornada?</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                            Se eliminará el partido contra <strong className="text-slate-800 dark:text-slate-200">{matchToDelete.opponent}</strong> ({formatDate(matchToDelete.date)}) y todos sus resultados.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setMatchToDelete(null)}
                                className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeDeleteMatch}
                                className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20"
                            >
                                <Trash2 size={15} /> Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MAIN MODAL RENDERING LOGIC --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-blue-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 my-4">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                            <div>
                                <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">
                                    {modalType.includes('PLAYER') ? 'Jugador' :
                                        modalType === 'GENERATE_CALENDAR' ? 'Calendario' :
                                            modalType.includes('MATCH') ? 'Jornada' : 'Equipo'}
                                </h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">
                                    {modalType === 'ADD_PLAYER' ? 'Añadir jugador al equipo' :
                                     modalType === 'EDIT_PLAYER' ? 'Editar datos del jugador' :
                                     modalType === 'ADD_MATCH' ? 'Crear nueva jornada' :
                                     modalType === 'EDIT_MATCH' ? 'Editar jornada existente' :
                                     modalType === 'GENERATE_CALENDAR' ? 'Generar jornadas automáticamente' :
                                     'Cambiar nombre del equipo'}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
                            {modalType.includes('PLAYER') && (<>
                                {modalType === 'ADD_PLAYER' && (<div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-4"><button className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${importMode === 'MANUAL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`} onClick={() => setImportMode('MANUAL')}>Manual</button><button className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${importMode === 'BULK' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`} onClick={() => setImportMode('BULK')}>Lista</button></div>)}
                                {importMode === 'MANUAL' ? (<>
                                    <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center overflow-hidden relative cursor-pointer">{tempPlayer.photoUrl ? (<img src={tempPlayer.photoUrl} className="w-full h-full object-cover" />) : (<Camera className="text-slate-300 dark:text-slate-500" />)}<input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handlePhotoUpload} /></div><div className="flex-1 space-y-4"><Input label="Nombre y Apellido" value={tempPlayer.name || ''} onChange={e => setTempPlayer(p => ({ ...p, name: e.target.value }))} /></div></div>
                                    <div className="grid grid-cols-2 gap-6"><Select label="Posición" value={tempPlayer.position || Position.AMBOS} onChange={e => setTempPlayer(p => ({ ...p, position: e.target.value as Position }))} options={[{ label: 'Drive', value: Position.DRIVE }, { label: 'Revés', value: Position.REVES }, { label: 'Ambos', value: Position.AMBOS }]} /><Input type="number" label="Puntos Iniciales" value={tempPlayer.initialPoints || ''} onChange={e => setTempPlayer(p => ({ ...p, initialPoints: Number(e.target.value) }))} /></div>
                                    <div className="pt-2"><Checkbox label="Es Zurdo" checked={tempPlayer.handedness === 'left'} onChange={(c) => setTempPlayer(p => ({ ...p, handedness: c ? 'left' : 'right' }))} /></div>
                                </>) : (
                                    <div className="space-y-6">
                                        <textarea className="w-full h-40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono outline-none focus:ring-2 focus:ring-lime-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" placeholder="Nombre Apellido, Posición, Puntos..." value={bulkText} onChange={handleBulkTextChange} />
                                        <div className="bg-lime-50 dark:bg-lime-900/20 text-lime-700 dark:text-lime-300 p-3 rounded-xl text-xs font-bold border border-lime-200 dark:border-lime-900/50">{tempPlayersList.length} jugadores detectados automáticamente.</div>
                                        {tempPlayersList.length > 0 && (
                                            <div className="mt-4 max-h-60 overflow-y-auto space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase">Previsualización ({tempPlayersList.length})</h4>
                                                {tempPlayersList.map((p, i) => (
                                                    <div key={i} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm">
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                                                        <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                            <span>{p.position}</span>
                                                            <span>{p.initialPoints} pts</span>
                                                            <span>{p.handedness === 'left' ? 'Zurdo' : 'Diestro'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>)}
                            {(modalType === 'ADD_MATCH' || modalType === 'EDIT_MATCH') && (<>

                                {/* Import Text Button Area */}
                                {!showMatchTextImport ? (
                                    <div className="flex justify-end mb-2">
                                        <button onClick={() => setShowMatchTextImport(true)} className="flex items-center gap-1 text-[10px] uppercase font-black text-lime-600 bg-lime-50 dark:bg-lime-900/20 dark:text-lime-400 px-3 py-2 rounded-lg hover:bg-lime-100 dark:hover:bg-lime-900/30 transition-colors">
                                            <List size={14} /> Importar desde WhatsApp
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mb-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Pega el texto del partido aquí</label>
                                        <textarea
                                            className="w-full h-32 p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm mb-2 outline-none focus:ring-2 focus:ring-lime-400"
                                            placeholder={`Ej:\nEquipo A - Equipo B\nSábado 15 - 17:30\n\n1 Pedro - Juan 6-4 7-6 👍🏻`}
                                            value={matchImportText}
                                            onChange={(e) => setMatchImportText(e.target.value)}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setShowMatchTextImport(false)} className="text-xs font-bold text-slate-500 px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
                                            <button onClick={handleMatchTextImport} disabled={isProcessingText || !matchImportText.trim()} className="text-xs font-bold bg-lime-400 text-blue-900 px-3 py-1.5 rounded-lg hover:bg-lime-300 flex items-center gap-2">
                                                {isProcessingText ? 'Procesando...' : <><Sparkles size={12} /> Interpretar con IA</>}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 items-end"><Input type="datetime-local" label="Fecha y Hora" value={tempMatch.date} onChange={e => setTempMatch(m => ({ ...m, date: e.target.value }))} /><div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex"><button className={`flex-1 py-3 text-xs font-black uppercase rounded-lg ${tempMatch.isHome ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`} onClick={() => setTempMatch(m => ({ ...m, isHome: true }))}>Local</button><button className={`flex-1 py-3 text-xs font-black uppercase rounded-lg ${!tempMatch.isHome ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-400'}`} onClick={() => setTempMatch(m => ({ ...m, isHome: false }))}>Visitante</button></div></div>
                                <div className="grid grid-cols-2 gap-4"><Input label="Rival" value={tempMatch.opponent} onChange={e => setTempMatch(m => ({ ...m, opponent: e.target.value }))} /><Input label="Sede / Notas" value={tempMatch.notes || ''} onChange={e => setTempMatch(m => ({ ...m, notes: e.target.value }))} /></div>

                                {/* HISTORICAL MATCH TOGGLE */}
                                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-200 dark:border-yellow-900/30">
                                    <Checkbox
                                        label="Modo Histórico (No sumar puntos)"
                                        checked={tempMatch.ignorePoints || false}
                                        onChange={(c) => setTempMatch(m => ({ ...m, ignorePoints: c }))}
                                    />
                                    <p className="text-[10px] text-yellow-700 dark:text-yellow-400 mt-1 ml-9 leading-tight">
                                        Activa esto si ya has incluido los puntos de este partido en los "Puntos Iniciales". El partido contará para estadísticas pero no duplicará puntos.
                                    </p>
                                </div>

                                {/* REST DAY TOGGLE */}
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-200 dark:border-blue-900/30">
                                    <Checkbox
                                        label="Jornada de Descanso"
                                        checked={tempMatch.isRestDay || false}
                                        onChange={(c) => setTempMatch(m => ({ ...m, isRestDay: c }))}
                                    />
                                    <p className="text-[10px] text-blue-700 dark:text-blue-400 mt-1 ml-9 leading-tight">
                                        Activa esto si en esta jornada el equipo no juega (descanso).
                                    </p>
                                </div>

                                <div className="w-full">
                                    <Select 
                                        label="Tandas" 
                                        value={tempMatch.tandas || (data?.settings?.gender === 'FEMENINO' ? '4' : '5')} 
                                        onChange={(e) => setTempMatch(m => ({ ...m, tandas: e.target.value }))} 
                                        options={TANDA_OPTIONS.filter(o => {
                                            if (data?.settings?.gender === 'FEMENINO') {
                                                return o.label.includes('Femenino');
                                            }
                                            return o.label.includes('Masculino');
                                        })} 
                                    />
                                </div>

                                {/* AVAILABILITY SECTION */}
                                <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 mt-2">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest">Convocatoria / Disponibilidad</h4>
                                        <div className="flex gap-2 items-center">
                                            <button type="button" onClick={() => setAllAvailability(true)} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Todos</button>
                                            <button type="button" onClick={() => setAllAvailability(false)} className="text-[10px] font-bold text-slate-400 hover:text-red-500 hover:underline">Ninguno</button>
                                            <button type="button" onClick={() => setIsAddingGuest(true)} className="ml-2 flex items-center gap-1 text-[10px] font-black bg-lime-400 hover:bg-lime-300 text-blue-900 px-2 py-1 rounded shadow-sm">
                                                <UserPlus size={12} /> + Filial
                                            </button>
                                        </div>
                                    </div>

                                    {isAddingGuest && (
                                        <div className="mb-4 flex gap-2 animate-in fade-in slide-in-from-top-2">
                                            <input
                                                autoFocus
                                                className="flex-1 px-3 py-2 rounded-lg border border-lime-300 dark:border-lime-800 bg-white dark:bg-slate-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500 shadow-sm"
                                                placeholder="Nombre del jugador del Filial..."
                                                value={guestName}
                                                onChange={(e) => setGuestName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && confirmAddGuest()}
                                            />
                                            <button onClick={confirmAddGuest} type="button" className="bg-lime-500 text-blue-900 px-3 py-2 rounded-lg font-bold text-xs hover:bg-lime-400 transition-colors shadow-sm">
                                                <Check size={16} />
                                            </button>
                                            <button onClick={() => { setIsAddingGuest(false); setGuestName(''); }} type="button" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 px-3 py-2 rounded-lg font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                                        {data?.players.map(p => {
                                            const isSelected = (tempMatch.availablePlayers || []).includes(p.id);
                                            return (
                                                <div
                                                    key={p.id}
                                                    onClick={() => toggleAvailability(p.id)}
                                                    className={`cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${isSelected ? 'bg-lime-50 dark:bg-lime-900/20 border-lime-400 dark:border-lime-700 text-slate-900 dark:text-lime-100 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-70 hover:opacity-100'}`}
                                                >
                                                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-lime-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                    {p.name} {(p.surname === '(Invitado)' || p.surname === '(Filial)') && <span className="text-[9px] text-blue-500 font-normal">(Filial)</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 italic">* Los jugadores en la alineación se marcarán como disponibles automáticamente.</p>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 mt-4">
                                    <h4 className="font-black text-xs uppercase text-slate-400 mb-6 tracking-widest">Partidos y Parejas</h4>
                                    <div className="space-y-3 mb-6">
                                        {(tempMatch.lineups || [])
                                            .map((l, originalIndex) => ({ ...l, originalIndex }))
                                            .sort((a, b) => (a.pairNumber || 99) - (b.pairNumber || 99))
                                            .map((l, i) => (
                                                <div key={l.originalIndex} className="flex justify-between items-center p-4 rounded-xl text-sm shadow-sm border bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${l.result === MatchResult.WIN ? 'bg-lime-500' : l.result === MatchResult.LOSS ? 'bg-red-500' : 'bg-slate-400'}`}></div>
                                                        <div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Pareja {l.pairNumber || l.originalIndex + 1}</div>
                                                            <div className="font-black text-slate-800 dark:text-white">{data?.players.find(p => p.id === l.player1Id)?.name} / {data?.players.find(p => p.id === l.player2Id)?.name}</div>
                                                            {l.opponent1Name && <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">vs {l.opponent1Name} / {l.opponent2Name}</div>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`font-mono font-black text-xs px-2 py-1 rounded shadow-sm ${l.result === MatchResult.WIN ? 'text-lime-700 bg-lime-100 dark:bg-lime-900/30 dark:text-lime-400 border border-lime-200 dark:border-lime-800' : l.result === MatchResult.LOSS ? 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' : 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800'}`}>
                                                            {l.set1} {l.set2} {l.set3}
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button onClick={() => editLineupInTempMatch(l.originalIndex)} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 size={16} /></button>
                                                            <button onClick={() => removeLineupFromTempMatch(l.originalIndex)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div className="md:col-span-1">
                                            <Input type="number" label="Pareja Nº" value={tempLineupScores.pairNumber} onChange={e => setTempLineupScores(l => ({ ...l, pairNumber: e.target.value }))} />
                                        </div>
                                        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <Select label="Jugador Revés" options={playerOptionsForSelect} value={tempLineupScores.player1Id} onChange={e => setTempLineupScores(l => ({ ...l, player1Id: e.target.value }))} />
                                            <Select label="Jugador Drive" options={playerOptionsForSelect} value={tempLineupScores.player2Id} onChange={e => setTempLineupScores(l => ({ ...l, player2Id: e.target.value }))} />
                                        </div>
                                    </div>
                                    {(tempMatch.availablePlayers || []).length === 0 && (
                                        <div className="text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded text-center">
                                            No hay jugadores disponibles seleccionados arriba.
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-3"><Input label="Rival 1 (Opcional)" value={tempLineupScores.opponent1Name} onChange={e => setTempLineupScores(l => ({ ...l, opponent1Name: e.target.value }))} /><Input label="Rival 2 (Opcional)" value={tempLineupScores.opponent2Name} onChange={e => setTempLineupScores(l => ({ ...l, opponent2Name: e.target.value }))} /></div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="flex flex-col gap-1 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase">Set 1</span><div className="flex gap-1"><input type="number" className="w-1/2 p-2 text-center bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-600 border rounded-lg font-black" value={tempLineupScores.s1We} onChange={e => setTempLineupScores(l => ({ ...l, s1We: e.target.value }))} /><input type="number" className="w-1/2 p-2 text-center bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-600 border rounded-lg font-black" value={tempLineupScores.s1They} onChange={e => setTempLineupScores(l => ({ ...l, s1They: e.target.value }))} /></div></div>
                                        <div className="flex flex-col gap-1 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase">Set 2</span><div className="flex gap-1"><input type="number" className="w-1/2 p-2 text-center bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-600 border rounded-lg font-black" value={tempLineupScores.s2We} onChange={e => setTempLineupScores(l => ({ ...l, s2We: e.target.value }))} /><input type="number" className="w-1/2 p-2 text-center bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-600 border rounded-lg font-black" value={tempLineupScores.s2They} onChange={e => setTempLineupScores(l => ({ ...l, s2They: e.target.value }))} /></div></div>
                                        <div className="flex flex-col gap-1 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase">Set 3</span><div className="flex gap-1"><input type="number" className="w-1/2 p-2 text-center bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-600 border rounded-lg font-black" value={tempLineupScores.s3We} onChange={e => setTempLineupScores(l => ({ ...l, s3We: e.target.value }))} /><input type="number" className="w-1/2 p-2 text-center bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-600 border rounded-lg font-black" value={tempLineupScores.s3They} onChange={e => setTempLineupScores(l => ({ ...l, s3They: e.target.value }))} /></div></div>
                                    </div>
                                    <Button variant="secondary" className="w-full text-xs font-black py-3 border-2 border-dashed border-blue-200 dark:border-slate-600 text-blue-600 dark:text-blue-300" onClick={addLineupToTempMatch}><Plus size={16} /> Añadir Pareja al Listado</Button>
                                </div>
                            </>)}

                            {modalType === 'GENERATE_CALENDAR' && (
                                <div className="space-y-6">
                                    {/* Tab Switcher */}
                                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                        <button className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${calendarMode === 'PATTERN' ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setCalendarMode('PATTERN')}>Patrón Automático</button>
                                        <button className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${calendarMode === 'IMAGE' ? 'bg-white dark:bg-slate-700 text-lime-700 dark:text-lime-400 shadow-sm border border-lime-200 dark:border-lime-800' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setCalendarMode('IMAGE')}><span className="flex items-center justify-center gap-1"><Sparkles size={12} /> Importar con IA</span></button>
                                    </div>

                                    {calendarMode === 'PATTERN' ? (
                                        <>
                                            <div className="bg-lime-50 dark:bg-lime-900/20 text-blue-900 dark:text-lime-100 p-4 rounded-xl text-sm border border-lime-200 dark:border-lime-900/50">
                                                <h4 className="font-bold flex items-center gap-2 mb-1"><Wand2 size={16} /> Generador Algorítmico</h4>
                                                <p className="opacity-80 text-xs">Crea jornadas secuenciales basadas en una lista de rivales y una frecuencia.</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <Input type="date" label="Inicio Temporada" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} />
                                                <Input type="time" label="Hora por defecto" value={genStartTime} onChange={(e) => setGenStartTime(e.target.value)} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <Select
                                                    label="Frecuencia"
                                                    value={genInterval}
                                                    onChange={(e) => setGenInterval(Number(e.target.value))}
                                                    options={[
                                                        { label: 'Semanal (7 días)', value: '7' },
                                                        { label: 'Quincenal (14 días)', value: '14' },
                                                        { label: 'Mensual (28 días)', value: '28' },
                                                        { label: 'Diaria (Torneo)', value: '1' }
                                                    ]}
                                                />
                                                <Select
                                                    label="Localidad"
                                                    value={genHomeAway}
                                                    onChange={(e) => setGenHomeAway(e.target.value as any)}
                                                    options={[
                                                        { label: 'Alternar (C/F)', value: 'ALTERNATE' },
                                                        { label: 'Siempre Local', value: 'HOME' },
                                                        { label: 'Siempre Visitante', value: 'AWAY' }
                                                    ]}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Lista de Rivales (Uno por línea)</label>
                                                <textarea
                                                    className="w-full h-32 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-lime-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                    placeholder="Club de Tenis A&#10;Padel Center B&#10;Los Amigos..."
                                                    value={genOpponents}
                                                    onChange={(e) => setGenOpponents(e.target.value)}
                                                />
                                                <div className="text-right mt-1 text-xs text-slate-400 font-bold">{genOpponents.split('\n').filter(s => s.trim()).length} jornadas detectadas</div>
                                            </div>
                                            <div className="pt-2">
                                                <Checkbox label="Crear Ida y Vuelta (Doble enfrentamiento)" checked={genDoubleRound} onChange={setGenDoubleRound} />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-slate-900 text-white p-4 rounded-xl text-sm border border-slate-700 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500 blur-[60px] opacity-20 rounded-full pointer-events-none"></div>
                                                <h4 className="font-bold flex items-center gap-2 mb-1 relative z-10"><ImageIcon size={16} /> Lector de Calendarios</h4>
                                                <p className="opacity-80 text-xs relative z-10">Sube una foto de tu calendario (Excel, Tabla, Papel) y la IA extraerá los partidos automáticamente.</p>
                                            </div>

                                            {!calendarImage ? (
                                                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative group">
                                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleCalendarImageUpload} />
                                                    <Upload className="text-slate-400 mb-2 group-hover:scale-110 transition-transform" size={32} />
                                                    <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Toca para subir imagen</span>
                                                    <span className="text-xs text-slate-400 mt-1">Soporta .jpg, .png</span>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl">
                                                        <img src={calendarImage} className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                                                        <div className="flex-1">
                                                            <span className="text-xs font-bold text-lime-600 uppercase tracking-wider block mb-1">Imagen Cargada</span>
                                                            <button onClick={() => { setCalendarImage(null); setPreviewMatches([]); }} className="text-xs text-red-500 hover:underline font-bold">Cambiar imagen</button>
                                                        </div>
                                                    </div>

                                                    <Input
                                                        label="Nombre de tu Club/Sede (Para saber si es Casa)"
                                                        placeholder="Ej. Racket Sport"
                                                        value={myClubName}
                                                        onChange={(e) => setMyClubName(e.target.value)}
                                                    />

                                                    {previewMatches.length === 0 ? (
                                                        <Button onClick={analyzeCalendarImage} disabled={!myClubName || isAnalyzingImage} className="w-full">
                                                            {isAnalyzingImage ? 'Analizando imagen...' : 'Extraer Partidos'}
                                                        </Button>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vista Previa ({previewMatches.length})</h4>
                                                            <div className="max-h-48 overflow-y-auto border rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                                                                {previewMatches.map((m, i) => (
                                                                    <div key={i} className="p-3 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm flex justify-between items-center">
                                                                        <div>
                                                                            <div className="font-bold text-slate-800 dark:text-white">{m.opponent}</div>
                                                                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{formatDate(m.date!)}</div>
                                                                        </div>
                                                                        <div className={`text-[10px] font-black uppercase px-2 py-1 rounded ${m.isHome ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                                                                            {m.isHome ? 'Casa' : 'Fuera'}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {modalType === 'EDIT_TEAM' && (<Input label="Nuevo Nombre del Equipo" value={tempTeamName} onChange={(e) => setTempTeamName(e.target.value)} />)}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button className="px-8 font-black" onClick={() => {
                                if (modalType === 'ADD_PLAYER') {
                                    if (importMode === 'MANUAL') addPlayer(tempPlayer); else addPlayersBulk();
                                } else if (modalType === 'EDIT_PLAYER') {
                                    updatePlayer(tempPlayer);
                                } else if (modalType === 'ADD_MATCH' || modalType === 'EDIT_MATCH') {
                                    saveMatch();
                                } else if (modalType === 'GENERATE_CALENDAR') {
                                    if (calendarMode === 'PATTERN') handleGenerateCalendar();
                                    else saveImportedMatches();
                                } else if (modalType === 'EDIT_TEAM') {
                                    handleUpdateTeamName();
                                }
                            }}>
                                {modalType === 'GENERATE_CALENDAR' ? 'Confirmar' : 'Guardar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default App;
import { MatchDay, MatchResult, Player, PlayoffBracket } from "../types";

// updateFavicon removed - now handled by static icon.svg and manifest

export const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

export const formatDate = (dateString: string) => {
    try {
        const d = new Date(dateString);
        return d.toLocaleDateString('es-ES', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
};

export const recalculateStats = (players: Player[], matches: MatchDay[], playoffs?: PlayoffBracket[]): Player[] => {
    const statsMap: Record<string, { matchesPlayed: number; wins: number }> = {};
    players.forEach(p => {
        statsMap[p.id] = { matchesPlayed: 0, wins: 0 };
    });

    // Liga
    (matches || []).forEach(match => {
        if (!match || !Array.isArray(match.lineups)) return;
        match.lineups.forEach(lineup => {
            if (!lineup) return;
            const playerIds = [lineup.player1Id, lineup.player2Id].filter(Boolean);
            playerIds.forEach(pid => {
                if (statsMap[pid]) {
                    statsMap[pid].matchesPlayed += 1;
                    if (lineup.result === MatchResult.WIN) {
                        statsMap[pid].wins += 1;
                    }
                }
            });
        });
    });

    // Playoffs — cada leg (ida y vuelta) cuenta igual que una jornada de liga
    (playoffs || []).forEach(bracket => {
        bracket.rounds.forEach(round => {
            round.ties.forEach(tie => {
                tie.legs.forEach(leg => {
                    if (!Array.isArray(leg.lineups)) return;
                    leg.lineups.forEach(lineup => {
                        if (!lineup) return;
                        const playerIds = [lineup.player1Id, lineup.player2Id].filter(Boolean);
                        playerIds.forEach(pid => {
                            if (statsMap[pid]) {
                                statsMap[pid].matchesPlayed += 1;
                                if (lineup.result === MatchResult.WIN) {
                                    statsMap[pid].wins += 1;
                                }
                            }
                        });
                    });
                });
            });
        });
    });

    return players.map(p => ({
        ...p,
        matchesPlayed: statsMap[p.id]?.matchesPlayed || 0,
        wins: statsMap[p.id]?.wins || 0,
    }));
};

/**
 * Flattens all played playoff legs into MatchDay-compatible objects
 * so PairsView, PlayerHistoryView and other stat views can include them transparently.
 * Pass seasonId to filter by season, or 'all' / undefined for all seasons.
 */
export const playoffLegsAsMatchDays = (playoffs: PlayoffBracket[] | undefined, seasonId?: string, ourTeamName?: string): MatchDay[] => {
    if (!playoffs) return [];
    const result: MatchDay[] = [];
    playoffs.forEach(bracket => {
        if (seasonId && seasonId !== 'all' && bracket.seasonId !== seasonId) return;
        bracket.rounds.forEach(round => {
            round.ties.forEach(tie => {
                tie.legs.forEach(leg => {
                    if (!leg.lineups || leg.lineups.length === 0) return;
                    // The ground truth for "who is us" is in leg[0].isHome of the tie:
                    // When the tie was created, the first leg's isHome reflects weAreHome.
                    // If tie.legs[0].isHome=true → tie.homeTeam=us → opponent=awayTeam always.
                    // If tie.legs[0].isHome=false → tie.awayTeam=us → opponent=homeTeam always.
                    // We also try ourTeamName as a name-based cross-check.
                    const firstLegIsHome = tie.legs[0]?.isHome ?? true;
                    const norm = (s: string) => (s || '')
                        .toLowerCase().trim()
                        .replace(/\s+/g, ' ')
                        .replace(/[\u2013\u2014\u2012\u2015\u2010\u2011]/g, '-');
                    const normUs = ourTeamName ? norm(ourTeamName) : '';
                    const normHome = norm(tie.homeTeam);
                    const normAway = norm(tie.awayTeam);
                    // Primary: name match
                    let weAreHomeTeam: boolean;
                    if (normUs && normHome === normUs) {
                        weAreHomeTeam = true;
                    } else if (normUs && normAway === normUs) {
                        weAreHomeTeam = false;
                    } else {
                        // Fallback: use first leg's isHome as ground truth
                        weAreHomeTeam = firstLegIsHome;
                    }
                    const opponent = weAreHomeTeam ? tie.awayTeam : tie.homeTeam;
                    result.push({
                        id: `playoff_${leg.id}`,
                        date: leg.date || new Date().toISOString(),
                        opponent,
                        isHome: leg.isHome,
                        lineups: leg.lineups,
                        notes: leg.notes,
                        tandas: leg.tandas,
                        availablePlayers: leg.availablePlayers,
                        seasonId: bracket.seasonId,
                    });
                });
            });
        });
    });
    return result;
};
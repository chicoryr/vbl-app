// Types for the external APIs
interface TournamentPlayerRaw {
  playerProfileId?: number;
  name?: string;
  isMale?: boolean;
}

interface TournamentTeamRaw {
  name?: string;
  dtCreated?: string;
  players?: TournamentPlayerRaw[];
}

interface TournamentDivisionRaw {
  gender?: { name?: string };
  teams?: TournamentTeamRaw[];
}

interface TournamentDataRaw {
  divisions?: TournamentDivisionRaw[];
}

interface RankingPlayerRaw {
  isMale?: boolean;
  points?: number;
}

interface RankingDataRaw {
  players?: RankingPlayerRaw[];
}

interface ProfileTournamentPointEntry {
  short?: string;
  used?: boolean;
  total?: number;
}

interface ProfileTournamentEntry {
  tournament?: string;
  points?: ProfileTournamentPointEntry[];
}

interface PlayerProfileRaw {
  tournaments?: ProfileTournamentEntry[];
}

// Response types
interface TeamPlayer {
  name: string;
  points: number;
}

interface TeamResponse {
  name: string;
  total: number;
  created: string;
  players: TeamPlayer[];
}

// Constants
const TOURNAMENT_URL = "https://api-v8.volleyballlife.com/tournament/39628";
const RANKING_URL = "https://api-v8.volleyballlife.com/ranking/new/33";
const PLAYER_PROFILE_URL = "https://api-v8.volleyballlife.com/playerprofile/";

const API_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

const FR_RANK_RE = /\(FR\s+(\d+)(?:st|nd|rd|th)\)/i;
const FR_POINTS_RE = /\(FR\s+(\d+(?:\.\d+)?)\)/i;
const BATCH_SIZE = 20;

/**
 * Fetch a player profile and sum their USAVP tournament points.
 * Mirrors the Python: iterates profile.tournaments[], sums points entries
 * where "USAVP" is in entry.short and entry.used is true.
 */
async function fetchPlayerPoints(
  profileId: number
): Promise<{ points: number; details: string[] }> {
  try {
    const res = await fetch(`${PLAYER_PROFILE_URL}${profileId}`, {
      headers: API_HEADERS,
    });
    if (!res.ok) return { points: 0, details: [] };

    const data: PlayerProfileRaw = await res.json();
    let totalPoints = 0;
    const details: string[] = [];

    for (const tourney of data.tournaments ?? []) {
      let tourneyPts = 0;
      for (const p of tourney.points ?? []) {
        if (
          p.short &&
          p.short.includes("USAVP") &&
          p.used === true &&
          typeof p.total === "number"
        ) {
          tourneyPts += p.total;
        }
      }
      if (tourneyPts > 0) {
        totalPoints += tourneyPts;
        details.push(`${tourney.tournament ?? "Unknown"}: ${tourneyPts} pts`);
      }
    }

    return { points: totalPoints, details };
  } catch {
    return { points: 0, details: [] };
  }
}

/**
 * Fetch player profiles in batches to avoid overwhelming the upstream API.
 */
async function fetchProfilesInBatches(
  ids: number[]
): Promise<Map<number, { points: number; details: string[] }>> {
  const results = new Map<number, { points: number; details: string[] }>();

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (id) => ({
        id,
        result: await fetchPlayerPoints(id),
      }))
    );
    for (const { id, result } of batchResults) {
      results.set(id, result);
    }
  }

  return results;
}

/**
 * Parse FR (free replacement) value from a player name.
 * Returns { type: "rank", value: number } or { type: "points", value: number } or null.
 */
function parseFRValue(
  name: string
): { type: "rank" | "points"; value: number } | null {
  const rankMatch = name.match(FR_RANK_RE);
  if (rankMatch) {
    return { type: "rank", value: parseInt(rankMatch[1], 10) };
  }
  const pointsMatch = name.match(FR_POINTS_RE);
  if (pointsMatch) {
    return { type: "points", value: parseFloat(pointsMatch[1]) };
  }
  return null;
}

export async function GET() {
  try {
    // 1. Fetch tournament and ranking data in parallel
    const [tourneyRes, rankingRes] = await Promise.all([
      fetch(TOURNAMENT_URL, { headers: API_HEADERS }),
      fetch(RANKING_URL, { headers: API_HEADERS }),
    ]);

    if (!tourneyRes.ok) {
      return Response.json(
        { error: "Failed to fetch tournament data" },
        { status: 502 }
      );
    }

    const tourneyData: TournamentDataRaw = await tourneyRes.json();

    // 2. Build ranking maps by gender
    // Each gender gets an array where index 0 = rank 1's points, etc.
    const maleRanks: number[] = [];
    const femaleRanks: number[] = [];

    if (rankingRes.ok) {
      const rankingData: RankingDataRaw = await rankingRes.json();
      for (const p of rankingData.players ?? []) {
        if (p.isMale) {
          maleRanks.push(p.points ?? 0);
        } else {
          femaleRanks.push(p.points ?? 0);
        }
      }
    }

    // 3. Extract teams from men's divisions
    const mensDivisions = (tourneyData.divisions ?? []).filter((div) =>
      (div.gender?.name ?? "").toLowerCase().startsWith("men")
    );

    // Gather team tasks and unique player profile IDs
    interface TeamTask {
      teamName: string;
      created: string;
      players: {
        id?: number;
        name: string;
        isMale: boolean;
      }[];
    }

    const teamTasks: TeamTask[] = [];
    const profileIdsToFetch = new Set<number>();

    for (const div of mensDivisions) {
      const genderName = (div.gender?.name ?? "").toLowerCase();
      const defaultIsMale = genderName.startsWith("men");

      for (const team of div.teams ?? []) {
        const players: TeamTask["players"] = [];

        for (const p of team.players ?? []) {
          const playerName = p.name ?? "";
          const isMale =
            p.isMale !== undefined && p.isMale !== null
              ? p.isMale
              : defaultIsMale;

          players.push({
            id: p.playerProfileId,
            name: playerName,
            isMale,
          });

          // Only fetch profiles for non-FR players
          if (p.playerProfileId && !parseFRValue(playerName)) {
            profileIdsToFetch.add(p.playerProfileId);
          }
        }

        teamTasks.push({
          teamName: team.name ?? "Unknown Team",
          created: team.dtCreated ?? "",
          players,
        });
      }
    }

    // 4. Fetch all player profiles concurrently in batches
    const profilesMap = await fetchProfilesInBatches(
      Array.from(profileIdsToFetch)
    );

    // 5. Calculate per-team totals
    const responseTeams: TeamResponse[] = [];

    for (const task of teamTasks) {
      let teamTotal = 0;
      const teamPlayers: TeamPlayer[] = [];

      for (const player of task.players) {
        let playerPoints = 0;

        const frValue = parseFRValue(player.name);
        if (frValue) {
          if (frValue.type === "points") {
            playerPoints = frValue.value;
          } else {
            // rank-based FR: look up points from ranking
            const ranksList = player.isMale ? maleRanks : femaleRanks;
            const rank = frValue.value;
            if (rank > 0 && rank <= ranksList.length) {
              playerPoints = ranksList[rank - 1];
            }
          }
        } else if (player.id) {
          const profileResult = profilesMap.get(player.id);
          if (profileResult) {
            playerPoints = profileResult.points;
          }
        }

        teamTotal += playerPoints;
        teamPlayers.push({ name: player.name, points: playerPoints });
      }

      responseTeams.push({
        name: task.teamName,
        total: teamTotal,
        created: task.created,
        players: teamPlayers,
      });
    }

    return Response.json({ teams: responseTeams });
  } catch (error) {
    console.error("Tournament API error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

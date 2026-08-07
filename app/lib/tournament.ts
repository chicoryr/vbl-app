'use server';

import { unstable_cache, updateTag } from 'next/cache';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeamPlayer {
  name: string;
  points: number;
}

export interface Team {
  id: number;
  name: string;
  total: number;
  created: string;
  seed: number | null;
  drop: boolean;
  waitlist: boolean;
  players: TeamPlayer[];
}

export interface ChangeEntry {
  timestamp: number;
  gender: string;
  type: 'team_added' | 'team_dropped' | 'team_undropped' | 'team_waitlisted' | 'team_off_waitlist' | 'points_changed' | 'seed_changed' | 'team_removed';
  description: string;
  teamName: string;
  details?: string;
}

export interface DivisionData {
  id: number;
  gender: string;
  teams: Team[];
  lastChanged: number | null;
}

export interface TournamentResult {
  divisions: DivisionData[];
  changes: ChangeEntry[];
  lastUpdated: number;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOURNAMENT_URL = (id: number) => `https://api-v8.volleyballlife.com/tournament/${id}`;
const DIVISION_HYDRATE_URL = 'https://api-v8.volleyballlife.com/division';

const API_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

// ─── In-memory state (resets on server restart) ──────────────────────────────

interface TeamSnapshot {
  name: string;
  total: number;
  seed: number | null;
  drop: boolean;
  waitlist: boolean;
  players: TeamPlayer[];
}

const previousTeams: Map<number, Map<string, TeamSnapshot>> = new Map();
const lastChangedTimestamps: Map<number, number> = new Map();
const changeLog: ChangeEntry[] = [];
const MAX_CHANGELOG = 200;

// ─── Change detection ────────────────────────────────────────────────────────

function detectChanges(divisionId: number, gender: string, newTeams: Team[]): ChangeEntry[] {
  const now = Date.now();
  const changes: ChangeEntry[] = [];
  const prevMap = previousTeams.get(divisionId);

  // First fetch — just store, no diff
  if (!prevMap) {
    const newMap = new Map<string, TeamSnapshot>();
    for (const t of newTeams) {
      newMap.set(t.name, { name: t.name, total: t.total, seed: t.seed, drop: t.drop, waitlist: t.waitlist, players: t.players });
    }
    previousTeams.set(divisionId, newMap);
    return changes;
  }

  const newMap = new Map<string, TeamSnapshot>();
  const newNames = new Set<string>();

  for (const t of newTeams) {
    newNames.add(t.name);
    newMap.set(t.name, { name: t.name, total: t.total, seed: t.seed, drop: t.drop, waitlist: t.waitlist, players: t.players });

    const prev = prevMap.get(t.name);
    if (!prev) {
      // New team registered
      changes.push({
        timestamp: now, gender, type: 'team_added', teamName: t.name,
        description: `${t.name} registered`,
        details: `Total points: ${t.total}`,
      });
      continue;
    }

    // Check drop status
    if (!prev.drop && t.drop) {
      changes.push({ timestamp: now, gender, type: 'team_dropped', teamName: t.name, description: `${t.name} dropped` });
    } else if (prev.drop && !t.drop) {
      changes.push({ timestamp: now, gender, type: 'team_undropped', teamName: t.name, description: `${t.name} re-entered` });
    }

    // Check waitlist
    if (!prev.waitlist && t.waitlist) {
      changes.push({ timestamp: now, gender, type: 'team_waitlisted', teamName: t.name, description: `${t.name} moved to waitlist` });
    } else if (prev.waitlist && !t.waitlist) {
      changes.push({ timestamp: now, gender, type: 'team_off_waitlist', teamName: t.name, description: `${t.name} moved off waitlist` });
    }

    // Check seed changes
    if (prev.seed !== t.seed) {
      const from = prev.seed ?? 'unseeded';
      const to = t.seed ?? 'unseeded';
      changes.push({
        timestamp: now, gender, type: 'seed_changed', teamName: t.name,
        description: `${t.name} seed changed`,
        details: `${from} → ${to}`,
      });
    }

    // Check points changes per player
    for (const player of t.players) {
      const prevPlayer = prev.players.find((p) => p.name === player.name);
      if (prevPlayer && prevPlayer.points !== player.points) {
        const diff = player.points - prevPlayer.points;
        const sign = diff > 0 ? '+' : '';
        changes.push({
          timestamp: now, gender, type: 'points_changed', teamName: t.name,
          description: `${player.name} points updated`,
          details: `${prevPlayer.points} → ${player.points} (${sign}${diff})`,
        });
      }
    }
  }

  // Check for removed teams
  for (const [name] of prevMap) {
    if (!newNames.has(name)) {
      changes.push({ timestamp: now, gender, type: 'team_removed', teamName: name, description: `${name} removed from tournament` });
    }
  }

  previousTeams.set(divisionId, newMap);
  return changes;
}

// ─── Core scraping logic ─────────────────────────────────────────────────────

async function scrapeTournamentData(tournamentId: number = 39628): Promise<TournamentResult> {
  console.log(`[tournament] Scraping VolleyballLife API for tournament ${tournamentId}...`);

  try {
    const tourneyRes = await fetch(TOURNAMENT_URL(tournamentId), { headers: API_HEADERS, cache: 'no-store' });
    if (!tourneyRes.ok) {
      return { divisions: [], changes: [...changeLog], lastUpdated: Date.now(), error: 'Failed to fetch tournament data' };
    }

    const tourneyData = await tourneyRes.json();
    const rawDivisions: { id: number; gender: { name: string } }[] = tourneyData.divisions ?? [];

    if (rawDivisions.length === 0) {
      return { divisions: [], changes: [...changeLog], lastUpdated: Date.now(), error: 'No divisions found. API may be rate limiting.' };
    }

    const divisionResults = await Promise.all(
      rawDivisions.map(async (div) => {
        try {
          const res = await fetch(`${DIVISION_HYDRATE_URL}/${div.id}/hydrate`, {
            headers: API_HEADERS,
            cache: 'no-store',
          });
          if (!res.ok) return null;

          const data = await res.json();
          const teams: Team[] = (data.teams ?? [])
            .filter((t: any) => !t.isDeleted)
            .map((t: any) => {
              const players: TeamPlayer[] = (t.players ?? []).map((p: any) => {
                const usavpEntry = (p.playerPoints ?? []).find((pp: any) => pp.system === 'USAVP');
                return { name: p.name ?? '', points: usavpEntry?.total ?? 0 };
              });

              return {
                id: t.id ?? 0,
                name: t.name ?? 'Unknown Team',
                total: players.reduce((sum, p) => sum + p.points, 0),
                created: t.dtCreated ?? '',
                seed: t.seed ?? null,
                drop: t.drop ?? false,
                waitlist: t.waitlist ?? false,
                players,
              };
            });

          // Detect changes
          const genderName = div.gender?.name ?? 'Unknown';
          const newChanges = detectChanges(div.id, genderName, teams);

          if (newChanges.length > 0) {
            changeLog.unshift(...newChanges);
            // Trim to max length
            if (changeLog.length > MAX_CHANGELOG) {
              changeLog.length = MAX_CHANGELOG;
            }
            lastChangedTimestamps.set(div.id, Date.now());
          }

          if (!lastChangedTimestamps.has(div.id)) {
            lastChangedTimestamps.set(div.id, Date.now());
          }

          return {
            id: div.id,
            gender: genderName,
            teams,
            lastChanged: lastChangedTimestamps.get(div.id) ?? null,
          } satisfies DivisionData;
        } catch (err) {
          console.error(`[tournament] Failed to hydrate division ${div.id}:`, err);
          return null;
        }
      })
    );

    const divisions = divisionResults.filter((d): d is DivisionData => d !== null);

    if (divisions.every((d) => d.teams.length === 0)) {
      return { divisions, changes: [...changeLog], lastUpdated: Date.now(), error: 'No teams found. API may be rate limiting.' };
    }

    console.log(
      `[tournament] Scrape successful: ${divisions.map((d) => `${d.gender}: ${d.teams.length} teams`).join(', ')}`
    );

    return { divisions, changes: [...changeLog], lastUpdated: Date.now() };
  } catch (error: any) {
    console.error('[tournament] Scraping error:', error);
    return { divisions: [], changes: [...changeLog], lastUpdated: Date.now(), error: error?.message || 'Internal Server Error' };
  }
}

// ─── Cached fetcher ──────────────────────────────────────────────────────────

export const getCachedTournamentData = async (tournamentId: number = 39628) => {
  return unstable_cache(
    async () => scrapeTournamentData(tournamentId),
    ['tournament-data', String(tournamentId)],
    { tags: [`tournament-${tournamentId}`], revalidate: 3600 }
  )();
};

// ─── Server Action: bust cache and refetch ───────────────────────────────────

export async function refreshTournamentData(tournamentId: number = 39628) {
  const data = await scrapeTournamentData(tournamentId);
  if (!data.error) {
    updateTag(`tournament-${tournamentId}`);
  }
  return data;
}

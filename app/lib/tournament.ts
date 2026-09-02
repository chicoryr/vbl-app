'use server';

import { unstable_cache, updateTag } from 'next/cache';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeamPlayer {
  name: string;
  points: number;
  truVolley: number;
}

export interface Team {
  id: number;
  name: string;
  total: number;
  truVolleyTotal: number;
  created: string;
  seed: number | null;
  drop: boolean;
  waitlist: boolean;
  players: TeamPlayer[];
}



export interface DivisionData {
  id: number;
  gender: string;
  teams: Team[];
  lastChanged: number | null;
}

export interface TournamentResult {
  divisions: DivisionData[];

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

const lastChangedTimestamps: Map<number, number> = new Map();

// ─── Core scraping logic ─────────────────────────────────────────────────────

async function scrapeTournamentData(tournamentId: number = 39628): Promise<TournamentResult> {
  console.log(`[tournament] Scraping VolleyballLife API for tournament ${tournamentId}...`);

  try {
    const tourneyRes = await fetch(TOURNAMENT_URL(tournamentId), { headers: API_HEADERS, cache: 'no-store' });
    if (!tourneyRes.ok) {
      return { divisions: [], lastUpdated: Date.now(), error: 'Failed to fetch tournament data' };
    }

    const tourneyData = await tourneyRes.json();
    const rawDivisions: { id: number; gender: { name: string } }[] = tourneyData.divisions ?? [];

    if (rawDivisions.length === 0) {
      return { divisions: [], lastUpdated: Date.now(), error: 'No divisions found. API may be rate limiting.' };
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
                const truVolley = (p.playerPoints ?? []).find((pp: any) => pp.system === 'TruVolley');
                const usavpEntry = (p.playerPoints ?? []).find((pp: any) => pp.system === 'USAVP');
                return { name: p.name ?? '', points: usavpEntry?.total ?? 0, truVolley: truVolley?.tru ?? 0 };
              });

              return {
                id: t.id ?? 0,
                name: t.name ?? 'Unknown Team',
                total: players.reduce((sum, p) => sum + p.points, 0),
                truVolleyTotal: players.reduce((sum, p) => sum + p.truVolley, 0),
                created: t.dtCreated ?? '',
                seed: t.seed ?? null,
                drop: t.drop ?? false,
                waitlist: t.waitlist ?? false,
                players,
              };
            });

          const genderName = div.gender?.name ?? 'Unknown';

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
      return { divisions, lastUpdated: Date.now(), error: 'No teams found. API may be rate limiting.' };
    }

    console.log(
      `[tournament] Scrape successful: ${divisions.map((d) => `${d.gender}: ${d.teams.length} teams`).join(', ')}`
    );

    return { divisions, lastUpdated: Date.now() };
  } catch (error: any) {
    console.error('[tournament] Scraping error:', error);
    return { divisions: [], lastUpdated: Date.now(), error: error?.message || 'Internal Server Error' };
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

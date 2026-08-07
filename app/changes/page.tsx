import React from 'react';
import { getCachedTournamentData } from '../lib/tournament';
import ChangeLogClient from '../components/ChangeLog';

export const dynamic = 'force-dynamic';

export default async function ChangesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const params = await searchParams;
  const tournamentId = params.id ? parseInt(params.id, 10) : 39628;
  const data = await getCachedTournamentData(tournamentId);

  return <ChangeLogClient changes={data.changes} tournamentId={tournamentId} />;
}

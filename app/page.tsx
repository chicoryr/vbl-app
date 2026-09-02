import React from 'react';
import { getCachedTournamentData } from './lib/tournament';
import DashboardClient from './components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function TournamentDashboard({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const params = await searchParams;
  const tournamentId = params.id ? parseInt(params.id, 10) : 39261;
  const initialData = await getCachedTournamentData(tournamentId);

  return <DashboardClient initialData={initialData} tournamentId={tournamentId} />;
}

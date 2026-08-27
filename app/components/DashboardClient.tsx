'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ControlBar from './ControlBar';
import Leaderboard from './Leaderboard';
import QualifierBracket from './QualifierBracket';
import { refreshTournamentData, TournamentResult } from '../lib/tournament';

type TabId = 'leaderboard' | 'bracket';
type Gender = 'Mens' | 'Womens';

function timeAgo(timestamp: number | null): string {
  if (!timestamp) return 'unknown';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardClient({ initialData, tournamentId }: { initialData: TournamentResult, tournamentId: number }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(initialData.error || null);
  const [inputTourneyId, setInputTourneyId] = useState(tournamentId.toString());

  useEffect(() => {
    setData(initialData);
    setError(initialData.error || null);
    setInputTourneyId(tournamentId.toString());
  }, [initialData, tournamentId]);

  const [isPending, startTransition] = useTransition();
  const [activeGender, setActiveGender] = useState<Gender>('Mens');
  const [sortBy, setSortBy] = useState<'points' | 'date'>('points');
  const [autoMainDraw, setAutoMainDraw] = useState(12);
  const [qToMd, setQToMd] = useState(4);
  const [activeTab, setActiveTab] = useState<TabId>('leaderboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Derive the active division's teams
  const activeDivision = useMemo(
    () => data.divisions.find((d) => d.gender === activeGender),
    [data.divisions, activeGender]
  );
  const teams = activeDivision?.teams ?? [];

  // Background refresh on mount
  useEffect(() => {
    handleRefresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = (isBackground = false) => {
    startTransition(async () => {
      if (!isBackground) setError(null);

      try {
        const newData = await refreshTournamentData(tournamentId);

        if (newData.error) {
          if (!isBackground) setError(newData.error);
          return;
        }

        setData((prev) => {
          const prevTeams = JSON.stringify(prev.divisions.map((d) => d.teams));
          const newTeams = JSON.stringify(newData.divisions.map((d) => d.teams));

          if (prevTeams !== newTeams) {
            if (prev.divisions.some((d) => d.teams.length > 0)) {
              setToast({ message: 'Tournament data has been updated!', type: 'success' });
              setTimeout(() => setToast(null), 4000);
            }
            return newData;
          } else if (!isBackground) {
            setToast({ message: 'Data is already up to date.', type: 'info' });
            setTimeout(() => setToast(null), 3000);
          }
          return prev;
        });
      } catch (err: any) {
        if (!isBackground) {
          setError(err.message || 'Failed to refresh data');
        }
      }
    });
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'bracket', label: 'Qualifier Bracket' },
  ];

  const genders: { id: Gender; label: string }[] = [
    { id: 'Mens', label: "Men's" },
    { id: 'Womens', label: "Women's" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-6 pt-6 pb-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-1 gap-4 md:gap-0">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 w-full">
              {/* Logo and Title */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20 shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight truncate">
                  VBL Tournament Tracker
                </h1>
              </div>

              {/* Input Field */}
              <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                <span className="text-sm text-gray-400 font-medium shrink-0">Tournament:</span>
                <input
                  type="text"
                  value={inputTourneyId}
                  onChange={(e) => setInputTourneyId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      let val = inputTourneyId.trim();
                      const match = val.match(/(?:event|tournament)\/(\d+)/);
                      if (match) val = match[1];
                      if (val !== tournamentId.toString()) router.push(`/?id=${val}`);
                    }
                  }}
                  onBlur={() => {
                    let val = inputTourneyId.trim();
                    const match = val.match(/(?:event|tournament)\/(\d+)/);
                    if (match) val = match[1];
                    if (val !== tournamentId.toString()) {
                      setInputTourneyId(val);
                      router.push(`/?id=${val}`);
                    } else {
                      setInputTourneyId(tournamentId.toString());
                    }
                  }}
                  placeholder="ID or VolleyballLife URL..."
                  className="bg-gray-800/80 border border-gray-600 text-gray-200 text-sm rounded-md px-3 py-1.5 w-full md:w-64 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 placeholder:text-gray-500 transition-all shadow-inner"
                />
                <span className="text-xs text-gray-500 italic hidden md:block whitespace-nowrap">
                  e.g., 39628 or avp.volleyballlife.com/event/39628
                </span>
              </div>
            </div>

            {/* Gender Toggle */}
            <div className="flex gap-1 bg-gray-900/60 backdrop-blur-md rounded-lg p-1 border border-white/10 self-start md:self-auto shrink-0">
              {genders.map((g) => {
                const div = data.divisions.find((d) => d.gender === g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => setActiveGender(g.id)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                      activeGender === g.id
                        ? 'bg-teal-500/20 text-teal-400 shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {g.label}
                    {div && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        activeGender === g.id ? 'bg-teal-500/30 text-teal-300' : 'bg-white/10 text-gray-500'
                      }`}>
                        {div.teams.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          {/* Controls */}
          <ControlBar
            onLoad={() => handleRefresh(false)}
            isLoading={false}
            sortBy={sortBy}
            onSortChange={setSortBy}
            autoMainDraw={autoMainDraw}
            onAutoMainDrawChange={(v) => setAutoMainDraw(Math.max(0, Math.min(256, v)))}
            qToMd={qToMd}
            onQToMdChange={(v) => setQToMd(Math.max(0, Math.min(128, v)))}
            teamCount={teams.length}
            lastUpdated={data.lastUpdated}
            isRefreshing={isPending}
          />

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm fade-in">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-1 bg-gray-900/40 backdrop-blur-md rounded-lg p-1 border border-white/10 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-teal-500/20 text-teal-400 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="slide-up">
            {activeTab === 'leaderboard' && (
              <Leaderboard
                teams={teams}
                sortBy={sortBy}
                autoMainDraw={autoMainDraw}
              />
            )}
            {activeTab === 'bracket' && (
              <QualifierBracket
                teams={teams}
                autoMainDraw={autoMainDraw}
                qToMd={qToMd}
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center text-xs text-gray-600">
          VBL Tournament Tracker
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-xl border flex items-center gap-3 backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
              : 'bg-blue-500/20 border-blue-500/50 text-blue-200'
          }`}>
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-medium text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70 transition-opacity">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

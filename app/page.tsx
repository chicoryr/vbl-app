'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ControlBar from './components/ControlBar';
import ProgressBar from './components/ProgressBar';
import Leaderboard from './components/Leaderboard';
import QualifierBracket from './components/QualifierBracket';

interface Team {
  name: string;
  total: number;
  created: string;
  players: { name: string; points: number }[];
}

type TabId = 'leaderboard' | 'bracket';

export default function TournamentDashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'points' | 'date'>('points');
  const [autoMainDraw, setAutoMainDraw] = useState(24);
  const [qToMd, setQToMd] = useState(8);
  const [activeTab, setActiveTab] = useState<TabId>('leaderboard');
  const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadData = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setLoadProgress({ current: 0, total: 1 });

    try {
      const res = await fetch('/api/tournament');

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      setLoadProgress({ current: 1, total: 1 });
      const data = await res.json();
      setTeams(data.teams ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setTeams([]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!hasLoaded) {
      setHasLoaded(true);
      loadData();
    }
  }, [hasLoaded, loadData]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'bracket', label: 'Qualifier Bracket' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-6 pt-6 pb-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                VBL Tournament Tracker
              </h1>
              <p className="text-sm text-gray-500">Tournament rankings & qualifier bracket</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 pb-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          {/* Controls */}
          <ControlBar
            onLoad={loadData}
            isLoading={isLoading}
            sortBy={sortBy}
            onSortChange={setSortBy}
            autoMainDraw={autoMainDraw}
            onAutoMainDrawChange={(v) => setAutoMainDraw(Math.max(0, Math.min(256, v)))}
            qToMd={qToMd}
            onQToMdChange={(v) => setQToMd(Math.max(0, Math.min(128, v)))}
            teamCount={teams.length}
          />

          {/* Progress */}
          <ProgressBar
            current={loadProgress.current}
            total={loadProgress.total}
            visible={isLoading}
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
    </div>
  );
}

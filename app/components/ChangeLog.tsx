'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChangeEntry } from '../lib/tournament';

type FilterType = 'all' | 'Mens' | 'Womens';

const changeIcons: Record<ChangeEntry['type'], { icon: string; color: string; bg: string }> = {
  team_added:       { icon: '➕', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  team_dropped:     { icon: '❌', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
  team_undropped:   { icon: '↩️', color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
  team_waitlisted:  { icon: '⏳', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  team_off_waitlist: { icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  points_changed:   { icon: '📊', color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20' },
  seed_changed:     { icon: '🏅', color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/20' },
  team_removed:     { icon: '🚫', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
};

const changeLabels: Record<ChangeEntry['type'], string> = {
  team_added: 'Registration',
  team_dropped: 'Drop',
  team_undropped: 'Re-entry',
  team_waitlisted: 'Waitlisted',
  team_off_waitlist: 'Off Waitlist',
  points_changed: 'Points Update',
  seed_changed: 'Seeding',
  team_removed: 'Removed',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Group changes by date
function groupByDate(changes: ChangeEntry[]): Map<string, ChangeEntry[]> {
  const groups = new Map<string, ChangeEntry[]>();
  for (const c of changes) {
    const dateKey = new Date(c.timestamp).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    const arr = groups.get(dateKey) ?? [];
    arr.push(c);
    groups.set(dateKey, arr);
  }
  return groups;
}

export default function ChangeLogClient({ changes, tournamentId }: { changes: ChangeEntry[], tournamentId: number }) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = filter === 'all' ? changes : changes.filter((c) => c.gender === filter);
  const grouped = groupByDate(filtered);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-6 pt-6 pb-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/?id=${tournamentId}`}
                className="w-10 h-10 rounded-lg bg-gray-800/60 border border-white/10 flex items-center justify-center hover:bg-gray-700/60 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Change Log</h1>
                <p className="text-sm text-gray-500">
                  {changes.length === 0
                    ? 'No changes detected yet — refresh the dashboard to start tracking'
                    : `${changes.length} changes tracked`
                  }
                </p>
              </div>
            </div>

            {/* Gender Filter */}
            <div className="flex gap-1 bg-gray-900/60 backdrop-blur-md rounded-lg p-1 border border-white/10">
              {([
                { id: 'all' as FilterType, label: 'All' },
                { id: 'Mens' as FilterType, label: "Men's" },
                { id: 'Womens' as FilterType, label: "Women's" },
              ]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filter === f.id
                      ? 'bg-teal-500/20 text-teal-400'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Timeline */}
      <main className="flex-1 px-6 pb-6">
        <div className="max-w-4xl mx-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-gray-400 text-lg">No changes detected yet</p>
              <p className="text-gray-600 text-sm mt-2">
                Changes will appear here after the next data refresh detects differences
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Array.from(grouped.entries()).map(([dateStr, entries]) => (
                <div key={dateStr}>
                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-sm font-medium text-gray-400">{dateStr}</div>
                    <div className="flex-1 h-px bg-white/5" />
                    <div className="text-xs text-gray-600">{entries.length} changes</div>
                  </div>

                  {/* Change Entries */}
                  <div className="space-y-2">
                    {entries.map((change, i) => {
                      const style = changeIcons[change.type];
                      return (
                        <div
                          key={`${change.timestamp}-${i}`}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${style.bg} transition-all hover:scale-[1.01]`}
                        >
                          <span className="text-lg mt-0.5">{style.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-white">
                                {change.description}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                change.gender === 'Mens'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-pink-500/20 text-pink-400'
                              }`}>
                                {change.gender === 'Mens' ? "Men's" : "Women's"}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">
                                {changeLabels[change.type]}
                              </span>
                            </div>
                            {change.details && (
                              <p className="text-xs text-gray-500 mt-1 font-mono">{change.details}</p>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 whitespace-nowrap flex flex-col items-end">
                            <span>{timeAgo(change.timestamp)}</span>
                            <span className="text-gray-700">{formatTime(change.timestamp)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center text-xs text-gray-600">
          VBL Tournament Tracker — Change Log
        </div>
      </footer>
    </div>
  );
}

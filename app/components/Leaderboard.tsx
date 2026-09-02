'use client';

import React, { useState, useMemo } from 'react';

interface Team {
  name: string;
  total: number;
  truVolleyTotal: number;
  created: string;
  players: { name: string; points: number, truVolley: number }[];
}

interface LeaderboardProps {
  teams: Team[];
  sortBy: 'points' | 'date' | 'truVolley';
  autoMainDraw: number;
}

export default function Leaderboard({ teams, sortBy, autoMainDraw }: LeaderboardProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (teamName: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamName)) {
        newSet.delete(teamName);
      } else {
        newSet.add(teamName);
      }
      return newSet;
    });
  };

  const processedTeams = useMemo(() => {
    if (!teams) return [];
    
    // First, determine ranks based on points sorted descending
    const pointsSorted = [...teams].sort((a, b) => b.total - a.total);
    const rankedTeams = pointsSorted.map((team, index) => {
      const isMD = index < autoMainDraw;
      const rank = isMD ? (index + 1).toString() : `Q${index - autoMainDraw + 1}`;
      return { ...team, rank, isMD };
    });

    // Then sort for display based on sortBy prop
    if (sortBy === 'points') {
      return rankedTeams;
    } else if (sortBy == 'date') {
      return rankedTeams.sort((a, b) => a.created.localeCompare(b.created));
    }else if (sortBy == 'truVolley') {
      return rankedTeams.sort((a, b) => a.truVolleyTotal.localeCompare(b.truVolleyTotal));
    }
  }, [teams, sortBy, autoMainDraw]);

  if (!teams || teams.length === 0) {
    return (
      <div className="w-full p-8 rounded-xl bg-gray-900/40 backdrop-blur-md border border-white/10 shadow-lg text-center text-gray-400">
        No data loaded
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl bg-gray-900/40 backdrop-blur-md border border-white/10 shadow-lg overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-300 border-collapse min-w-[600px]">
        <thead className="bg-gray-800/80 sticky top-0 border-b border-white/10">
          <tr>
            <th className="px-6 py-4 font-semibold w-24">Rank</th>
            <th className="px-6 py-4 font-semibold">Team</th>
            <th className="px-6 py-4 font-semibold w-32">Total Points</th>
            <th className="px-6 py-4 font-semibold w-32">Reg Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {processedTeams.map((team, idx) => {
            const isExpanded = expandedRows.has(team.name);
            const rowBg = idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]';
            const borderStyle = team.isMD 
              ? 'border-l-[3px] border-l-teal-500/30' 
              : 'border-l-[3px] border-l-amber-500/30';

            return (
              <React.Fragment key={team.name}>
                <tr 
                  onClick={() => toggleRow(team.name)}
                  className={`${rowBg} ${borderStyle} hover:bg-white/[0.05] transition-colors cursor-pointer`}
                >
                  <td className="px-6 py-3 font-medium text-gray-400">{team.rank}</td>
                  <td className="px-6 py-3 font-medium text-white">{team.name}</td>
                  <td className="px-6 py-3 text-teal-400 font-mono">{team.total.toFixed(1)}</td>
                  <td className="px-6 py-3 text-gray-500">{team.created.substring(0, 10)}</td>
                </tr>
                {isExpanded && (
                  <tr className="bg-black/30 border-l-[3px] border-l-transparent">
                    <td colSpan={4} className="px-6 py-3">
                      <div className="flex flex-col gap-2 pl-8">
                        {team.players.map((player, pIdx) => (
                          <div key={pIdx} className="flex items-center gap-4 text-xs">
                            <span className="text-gray-400 w-32">{player.name}</span>
                            <span className="text-teal-500/70 font-mono">{player.points.toFixed(1)} pts</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

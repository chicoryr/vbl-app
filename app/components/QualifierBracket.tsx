'use client';

import React, { useMemo, useState, useRef } from 'react';

interface Team {
  id: number;
  name: string;
  total: number;
  created: string;
  players: { name: string; points: number }[];
}

interface QualifierBracketProps {
  teams: Team[];
  autoMainDraw: number;
  qToMd: number;
}

interface BracketTeam {
  id: number;
  seed: number;
  name: string;
  fullName: string;
  points: number;
  players: { name: string; points: number }[];
  isBye: boolean;
}

interface BracketMatch {
  id: string;
  round: number;
  matchIndex: number;
  team1: BracketTeam | null;
  team2: BracketTeam | null;
  winnerTo?: string;
}

export default function QualifierBracket({ teams, autoMainDraw, qToMd }: QualifierBracketProps) {
  const [hoveredTeam, setHoveredTeam] = useState<{
    key: string;
    x: number;
    y: number;
    team: BracketTeam;
  } | null>(null);
  
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (key: string, x: number, y: number, team: BracketTeam) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoveredTeam({ key, x, y, team });
  };

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setHoveredTeam(null);
    }, 150);
  };

  const bracketData = useMemo(() => {
    if (!teams || teams.length === 0) return { rounds: [], qTeams: [] };

    const pointsSorted = [...teams].sort((a, b) => b.total - a.total);
    
    const qTeams = pointsSorted.slice(autoMainDraw).map((team, index) => ({
      id: team.id,
      seed: index + 1,
      label: `Q${index + 1}`,
      name: team.name.split('/').map((n) => n.trim().split(/\s+/).pop()).join(' / '),
      fullName: team.name,
      points: team.total,
      players: team.players,
    }));

    if (qTeams.length === 0) return { rounds: [], qTeams: [] };

    const numTeams = qTeams.length;
    let bracketSize = 1;
    while (bracketSize < numTeams) bracketSize *= 2;

    let seedOrder = [1];
    while (seedOrder.length < bracketSize) {
      const currentLength = seedOrder.length;
      const modifier = currentLength * 2 + 1;
      const nextOrder = [];
      for (const s of seedOrder) {
        nextOrder.push(s);
        nextOrder.push(modifier - s);
      }
      seedOrder = nextOrder;
    }

    const firstRoundMatches: BracketMatch[] = [];
    for (let i = 0; i < bracketSize / 2; i++) {
      const seed1 = seedOrder[i * 2];
      const seed2 = seedOrder[i * 2 + 1];
      
      const team1Obj = qTeams.find(t => t.seed === seed1);
      const team2Obj = qTeams.find(t => t.seed === seed2);

      const toBracketTeam = (obj: typeof team1Obj, seed: number): BracketTeam =>
        obj
          ? { id: obj.id, seed, name: obj.name, fullName: obj.fullName, points: obj.points, players: obj.players, isBye: false }
          : { id: 0, seed, name: 'BYE', fullName: 'BYE', points: 0, players: [], isBye: true };

      firstRoundMatches.push({
        id: `r1-m${i}`,
        round: 1,
        matchIndex: i,
        team1: toBracketTeam(team1Obj, seed1),
        team2: toBracketTeam(team2Obj, seed2),
      });
    }

    const rounds: BracketMatch[][] = [firstRoundMatches];
    let currentRoundMatches = firstRoundMatches;
    let roundNum = 2;

    while (currentRoundMatches.length > Math.max(1, qToMd)) {
      const nextRoundMatches: BracketMatch[] = [];
      const numMatches = currentRoundMatches.length / 2;
      
      for (let i = 0; i < numMatches; i++) {
        const m1 = currentRoundMatches[i * 2];
        const m2 = currentRoundMatches[i * 2 + 1];
        
        const nextMatchId = `r${roundNum}-m${i}`;
        m1.winnerTo = nextMatchId;
        m2.winnerTo = nextMatchId;

        let t1 = null;
        let t2 = null;
        
        if (m1.team2?.isBye) t1 = m1.team1;
        else if (m1.team1?.isBye) t1 = m1.team2;
        
        if (m2.team2?.isBye) t2 = m2.team1;
        else if (m2.team1?.isBye) t2 = m2.team2;

        nextRoundMatches.push({
          id: nextMatchId,
          round: roundNum,
          matchIndex: i,
          team1: t1,
          team2: t2
        });
      }
      
      rounds.push(nextRoundMatches);
      currentRoundMatches = nextRoundMatches;
      roundNum++;
    }

    return { rounds, qTeams };
  }, [teams, autoMainDraw, qToMd]);

  if (bracketData.qTeams.length === 0) {
    return (
      <div className="w-full p-8 rounded-xl bg-gray-900/40 backdrop-blur-md border border-white/10 shadow-lg text-center text-gray-400">
        No qualifier teams
      </div>
    );
  }

  if (qToMd === 0) {
    return (
      <div className="w-full p-8 rounded-xl bg-gray-900/40 backdrop-blur-md border border-white/10 shadow-lg text-center text-gray-400">
        Q to MD is 0 - no teams can advance
      </div>
    );
  }

  const { rounds } = bracketData;
  
  const TEAM_WIDTH = 240;
  const TEAM_HEIGHT = 32;
  const MATCH_GAP_Y = 12;
  const ROUND_GAP_X = 320;
  const ROW_HEIGHT = 80;
  
  const matchesCoords = new Map<string, { x: number, y: number, h: number }>();
  
  const svgWidth = (rounds.length + 1) * ROUND_GAP_X + 40;
  let maxSvgHeight = 0;

  rounds.forEach((roundMatches, rIndex) => {
    roundMatches.forEach((match, mIndex) => {
      const x = 20 + rIndex * ROUND_GAP_X;
      let y = 0;
      let h = TEAM_HEIGHT * 2 + MATCH_GAP_Y;

      if (rIndex === 0) {
        y = 60 + mIndex * ROW_HEIGHT;
      } else {
        const prevM1 = rounds[rIndex - 1][mIndex * 2];
        const prevM2 = rounds[rIndex - 1][mIndex * 2 + 1];
        const c1 = matchesCoords.get(prevM1.id);
        const c2 = matchesCoords.get(prevM2.id);
        
        if (c1 && c2) {
          y = (c1.y + c1.h / 2 + c2.y + c2.h / 2) / 2 - h / 2;
        }
      }
      
      matchesCoords.set(match.id, { x, y, h });
      maxSvgHeight = Math.max(maxSvgHeight, y + h + 40);
    });
  });

  return (
    <div className="w-full flex flex-col rounded-xl bg-gray-900/40 backdrop-blur-md border border-white/10 shadow-lg overflow-hidden">
      <div className="p-4 border-b border-white/10 bg-gray-800/50">
        <h3 className="text-lg font-medium text-white">Qualifier Bracket</h3>
        <p className="text-sm text-gray-400">{bracketData.qTeams.length} Teams | {qToMd} Advance</p>
      </div>
      <div className="overflow-x-auto w-full p-4 custom-scrollbar">
        <svg width={svgWidth} height={maxSvgHeight} className="min-w-max">
          {rounds.map((roundMatches, rIndex) => {
            if (rIndex === rounds.length - 1) return null;
            
            return roundMatches.map((match, mIndex) => {
              if (match.team1?.isBye || match.team2?.isBye) return null;
              const c = matchesCoords.get(match.id);
              const nextM = match.winnerTo ? matchesCoords.get(match.winnerTo) : null;
              if (!c || !nextM) return null;

              const isTop = mIndex % 2 === 0;
              
              const startX = c.x + TEAM_WIDTH;
              const startY = c.y + c.h / 2;
              const endX = nextM.x;
              const endY = nextM.y + (isTop ? TEAM_HEIGHT / 2 : c.h - TEAM_HEIGHT / 2);
              
              const midX = startX + (endX - startX) / 2;

              return (
                <path
                  key={`path-${match.id}`}
                  d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
                  fill="none"
                  stroke="#4b5563"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            });
          })}
          
          {rounds[rounds.length - 1]?.map(match => {
             if (match.team1?.isBye || match.team2?.isBye) return null;
             const c = matchesCoords.get(match.id);
             if (!c) return null;
             
             const startX = c.x + TEAM_WIDTH;
             const startY = c.y + c.h / 2;
             const endX = c.x + ROUND_GAP_X;
             
             return (
               <path
                 key={`path-final-${match.id}`}
                 d={`M ${startX} ${startY} L ${endX} ${startY}`}
                 fill="none"
                 stroke="#4b5563"
                 strokeWidth="2"
                 strokeLinecap="round"
               />
             );
          })}

          {rounds.map((roundMatches, rIndex) => {
            return (
              <g key={`round-${rIndex}`}>
                <text x={20 + rIndex * ROUND_GAP_X} y={30} fill="#9ca3af" fontSize="14" fontWeight="600">
                  Round {rIndex + 1}
                </text>
                
                {roundMatches.map(match => {
                  if (match.team1?.isBye || match.team2?.isBye) return null;
                  const c = matchesCoords.get(match.id);
                  if (!c) return null;

                  const renderTeamBox = (team: BracketMatch['team1'], isBottom: boolean) => {
                    const boxY = c.y + (isBottom ? TEAM_HEIGHT + MATCH_GAP_Y : 0);
                    const isBye = team?.isBye;
                    const teamKey = `${match.id}-${isBottom ? 't2' : 't1'}`;
                    const isHovered = hoveredTeam?.key === teamKey;
                    
                    return (
                      <g
                        transform={`translate(${c.x}, ${boxY})`}
                        key={teamKey}
                        onMouseEnter={() => team && !isBye && handleMouseEnter(teamKey, c.x, boxY, team)}
                        onMouseLeave={handleMouseLeave}
                        style={{ cursor: team && !isBye ? 'pointer' : 'default' }}
                      >
                        <rect
                          width={TEAM_WIDTH}
                          height={TEAM_HEIGHT}
                          rx="4"
                          fill={isBye ? '#1f293780' : isHovered ? '#263344' : '#1f2937'}
                          stroke={isBye ? '#374151' : isHovered ? '#14b8a6' : '#374151'}
                          strokeWidth="1"
                          strokeDasharray={isBye ? '4 2' : 'none'}
                          style={{ transition: 'fill 0.15s, stroke 0.15s' }}
                        />
                        {team && !isBye ? (
                          <>
                            <rect width="32" height={TEAM_HEIGHT} rx="4" fill="#f59e0b20" />
                            <text x="16" y="21" fill="#f59e0b" fontSize="12" fontWeight="600" textAnchor="middle">
                              Q{team.seed}
                            </text>
                            <text x="40" y="21" fill="#14b8a6" fontSize="13" fontWeight="500">
                              {team.name.length > 20 ? team.name.substring(0, 18) + '...' : team.name}
                            </text>
                            <text x={TEAM_WIDTH - 8} y="21" fill="#9ca3af" fontSize="12" textAnchor="end">
                              {team.points.toFixed(1)}
                            </text>
                          </>
                        ) : (
                          <text x="40" y="21" fill="#4b5563" fontSize="12" fontStyle="italic">
                          </text>
                        )}
                      </g>
                    );
                  };

                  return (
                    <g key={`match-${match.id}`}>
                      {renderTeamBox(match.team1, false)}
                      {renderTeamBox(match.team2, true)}
                    </g>
                  );
                })}
              </g>
            );
          })}
          
          {rounds.length > 0 && (
            <g>
              <text x={20 + rounds.length * ROUND_GAP_X} y={30} fill="#14b8a6" fontSize="14" fontWeight="600">
                Qualifiers ({Math.min(rounds[rounds.length-1].length, qToMd)})
              </text>
              
              {rounds[rounds.length - 1].map(match => {
                const c = matchesCoords.get(match.id);
                if (!c) return null;
                
                return (
                  <g transform={`translate(${c.x + ROUND_GAP_X}, ${c.y + c.h / 2 - TEAM_HEIGHT / 2})`} key={`adv-${match.id}`}>
                    <rect
                      width={TEAM_WIDTH}
                      height={TEAM_HEIGHT}
                      rx="4"
                      fill="#111827"
                      stroke="#14b8a650"
                      strokeWidth="1"
                      strokeDasharray="4 2"
                    />
                    <text x="40" y="21" fill="#4b5563" fontSize="13" fontStyle="italic">
                      Advances to Main Draw
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Tooltip — rendered last so it's always on top */}
          {hoveredTeam && (
            <foreignObject
              x={hoveredTeam.x}
              y={hoveredTeam.y}
              width="260"
              height={TEAM_HEIGHT + 4 + 120}
              style={{ pointerEvents: 'auto', overflow: 'visible' }}
              onMouseEnter={() => {
                if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
              }}
              onMouseLeave={handleMouseLeave}
            >
              {/* Invisible bridge covering the team box + gap */}
              <div style={{ height: TEAM_HEIGHT + 4, width: '100%' }} />
              <div
                style={{
                  background: '#111827',
                  border: '1px solid rgba(20, 184, 166, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  color: '#e5e7eb',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ fontWeight: 600, color: '#14b8a6', marginBottom: '6px' }}>
                  {hoveredTeam.team.fullName}
                </div>
                {hoveredTeam.team.players.map((p, pi) => (
                  <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ color: '#d1d5db' }}>{p.name}</span>
                    <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{p.points.toFixed(1)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '6px', paddingTop: '6px' }}>
                  <a
                    href={`https://avp.volleyballlife.com/event/39628/team/${hoveredTeam.team.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#14b8a6', textDecoration: 'none', fontSize: '11px' }}
                  >
                    View on VolleyballLife →
                  </a>
                </div>
              </div>
            </foreignObject>
          )}
        </svg>
      </div>
    </div>
  );
}

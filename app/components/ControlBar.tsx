'use client';

import React from 'react';

interface ControlBarProps {
  onLoad: () => void;
  isLoading: boolean;
  sortBy: 'points' | 'date';
  onSortChange: (sort: 'points' | 'date' | 'truVolley') => void;
  autoMainDraw: number;
  onAutoMainDrawChange: (value: number) => void;
  qToMd: number;
  onQToMdChange: (value: number) => void;
  teamCount: number;
  lastUpdated?: number | null;
  isRefreshing?: boolean;
}

export default function ControlBar({
  onLoad,
  isLoading,
  sortBy,
  onSortChange,
  autoMainDraw,
  onAutoMainDrawChange,
  qToMd,
  onQToMdChange,
  teamCount,
  lastUpdated,
  isRefreshing
}: ControlBarProps) {
  return (
    <div className="flex flex-row flex-wrap items-center gap-4 p-4 rounded-xl bg-gray-900/40 backdrop-blur-md border border-white/10 shadow-lg">
      <button
        onClick={onLoad}
        disabled={isLoading}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium hover:brightness-110 disabled:opacity-50 transition-all"
      >
        <svg 
          className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {isLoading ? 'Loading...' : 'Load / Refresh'}
      </button>

      <div className="flex items-center bg-black/50 rounded-lg p-1 border border-white/10">
        <button
          onClick={() => onSortChange('points')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${sortBy === 'points' ? 'bg-teal-500 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Points
        </button>
        <button
          onClick={() => onSortChange('date')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${sortBy === 'date' ? 'bg-teal-500 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Date
        </button>
        <button
          onClick={() => onSortChange('truVolley')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${sortBy === 'truVolley' ? 'bg-teal-500 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          TruVolley
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-300 font-medium">Auto MD:</label>
        <input 
          type="number" 
          min={0} 
          max={256} 
          value={autoMainDraw} 
          onChange={(e) => onAutoMainDrawChange(parseInt(e.target.value) || 0)}
          className="w-16 px-2 py-1 bg-black/50 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-300 font-medium">Q→MD:</label>
        <input 
          type="number" 
          min={0} 
          max={128} 
          value={qToMd} 
          onChange={(e) => onQToMdChange(parseInt(e.target.value) || 0)}
          className="w-16 px-2 py-1 bg-black/50 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
        />
      </div>

      <div className="ml-auto flex items-center gap-3 text-sm text-gray-400 font-medium">
        {lastUpdated && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 rounded-lg border border-white/5">
            <svg className={`w-4 h-4 text-teal-500 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Checking for updates...' : `Last loaded: ${new Date(lastUpdated).toLocaleTimeString()}`}
          </div>
        )}
        <div className="px-3 py-1.5 bg-black/40 rounded-lg border border-white/5">
          Teams: <span className="text-white">{teamCount}</span>
        </div>
      </div>
    </div>
  );
}

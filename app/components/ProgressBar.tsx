'use client';

import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  visible: boolean;
}

export default function ProgressBar({ current, total, visible }: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  
  return (
    <div className={`w-full flex flex-col gap-1 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {total > 0 && (
        <div className="text-xs text-center text-gray-400 font-medium">
          {Math.round(percentage)}%
        </div>
      )}
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full transition-all duration-500 ease-out relative"
          style={{ width: `${percentage}%` }}
        >
          {visible && (
            <div className="absolute top-0 left-0 w-full h-full animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] bg-white/20" />
          )}
        </div>
      </div>
    </div>
  );
}

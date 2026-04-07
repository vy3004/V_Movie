"use client";

import { useState } from "react";
import { Episode, ServerData, EpisodeProgress } from "@/lib/types";

interface EpisodeSelectorProps {
  servers: Episode[];
  episodeSelected: string | null;
  onSelect: (data: ServerData) => void;
  episodesProgress?: Record<string, EpisodeProgress>;
}

const EpisodeSelector = ({
  servers,
  episodeSelected,
  onSelect,
  episodesProgress = {},
}: EpisodeSelectorProps) => {
  // Default to first server that has data
  const [activeServerIdx, setActiveServerIdx] = useState(() => {
    const idx = servers.findIndex((s) => s.server_data.length > 0);
    return idx >= 0 ? idx : 0;
  });

  const activeServer = servers[activeServerIdx];

  // Count servers that have episodes
  const serversWithEpisodes = servers.filter((s) => s.server_data.length > 0);
  const showServerTabs = serversWithEpisodes.length > 1;

  return (
    <div>
      {/* Server selector tabs - only show if multiple servers have episodes */}
      {showServerTabs && (
        <div className="flex flex-wrap gap-2 mb-4">
          {servers.map((server, idx) => {
            const hasEpisodes = server.server_data.length > 0;
            const isActive = idx === activeServerIdx;
            return (
              <button
                key={idx}
                onClick={() => hasEpisodes && setActiveServerIdx(idx)}
                disabled={!hasEpisodes}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : hasEpisodes
                      ? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                      : "bg-gray-800/40 text-gray-600 cursor-not-allowed"
                }`}
              >
                {server.server_name}
                {!hasEpisodes && (
                  <span className="ml-1 text-xs opacity-50">(Trống)</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Episode grid for active server */}
      {activeServer && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
          {activeServer.server_data.length > 0 ? (
            activeServer.server_data.map((sv) => {
              const progress = episodesProgress[sv.slug];
              const isFinished = progress?.ep_is_finished || false;
              const progressPercent =
                progress && progress.ep_duration > 0
                  ? Math.min(
                      (progress.ep_last_time / progress.ep_duration) * 100,
                      100
                    )
                  : 0;
              const isSelected = sv.slug === episodeSelected;

              return (
                <button
                  key={sv.slug}
                  className={`group relative p-2 rounded hover:bg-primary transition flex items-center justify-center min-h-[2.5rem] ${
                    isSelected
                      ? "bg-primary"
                      : isFinished
                        ? "bg-gray-800/60"
                        : "bg-gray-800"
                  }`}
                  onClick={() => onSelect(sv)}
                  disabled={isSelected}
                >
                  {/* Episode name - always centered vertically and horizontally */}
                  <span className="text-sm font-medium truncate w-full text-center">
                    {sv.name}
                  </span>

                  {/* Progress bar - absolute positioned at bottom edge */}
                  {progress && progressPercent > 0 && !isSelected && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700 rounded-b overflow-hidden group-hover:opacity-0 transition-opacity">
                      <div
                        className={`h-full rounded-b transition-all ${
                          isFinished ? "bg-green-500" : "bg-primary"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  {/* Finished indicator */}
                  {isFinished && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3 text-white"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <p className="text-center text-gray-500 col-span-full">
              Không có tập phim nào để chọn.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default EpisodeSelector;
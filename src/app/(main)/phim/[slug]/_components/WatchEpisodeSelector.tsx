"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Bars3CenterLeftIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import {
  getAvailableServersForEpisode,
  getEpisodeList,
  getEpisodeProgressKey,
  getSourceBadge,
} from "@/services/movie-sources/utils";
import { Episode, ServerData, EpisodeProgress, MovieSource } from "@/types";

interface WatchEpisodeSelectorProps {
  servers: Episode[];
  selectedEpisodeKey: string;
  onSelect: (data: ServerData) => void;
  episodesProgress?: Record<string, EpisodeProgress>;
  activeServerIdx: number;
  onServerChange: (idx: number) => void;
}

const RANGE_SIZE = 40;
const THRESHOLD = 80;

const SOURCE_BADGE_CLASS: Record<MovieSource, string> = {
  ophim: "bg-red-500/15 text-red-400 border-red-500/30",
  phimapi: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

function stripSourcePrefix(name: string): string {
  return name.replace(/^(OP|PA|NC) - /, "");
}

const WatchEpisodeSelector = ({
  servers,
  selectedEpisodeKey,
  onSelect,
  episodesProgress = {},
  activeServerIdx,
  onServerChange,
}: WatchEpisodeSelectorProps) => {
  const episodes = useMemo(() => getEpisodeList(servers), [servers]);
  const availableServerEntries = useMemo(
    () => getAvailableServersForEpisode(servers, selectedEpisodeKey),
    [servers, selectedEpisodeKey],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeRangeIdx, setActiveRangeIdx] = useState(0);
  const ranges = useMemo(() => {
    if (episodes.length <= THRESHOLD) return [];
    const groups = [];
    for (let i = 0; i < episodes.length; i += RANGE_SIZE) {
      const end = Math.min(i + RANGE_SIZE, episodes.length);
      groups.push({
        startIdx: i,
        endIdx: end,
        label: `Tập ${episodes[i].name} - ${episodes[end - 1].name}`,
      });
    }
    return groups;
  }, [episodes]);

  useEffect(() => {
    if (!searchTerm && ranges.length > 0 && selectedEpisodeKey) {
      const currentEpIdx = episodes.findIndex(
        (ep) => getEpisodeProgressKey(ep) === selectedEpisodeKey,
      );
      if (currentEpIdx !== -1) {
        const rangeIdx = Math.floor(currentEpIdx / RANGE_SIZE);
        setActiveRangeIdx(Math.min(rangeIdx, ranges.length - 1));
      }
    }
    if (!searchTerm && ranges.length > 0 && !selectedEpisodeKey) {
      setActiveRangeIdx(0);
    }
  }, [selectedEpisodeKey, ranges.length, episodes, searchTerm]);

  const filteredEpisodes = useMemo(() => {
    if (searchTerm.trim()) {
      return episodes.filter((ep) =>
        ep.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }
    if (ranges.length === 0) return episodes;

    const safeRangeIdx = activeRangeIdx >= ranges.length ? 0 : activeRangeIdx;
    const range = ranges[safeRangeIdx];

    if (!range) return episodes;

    return episodes.slice(range.startIdx, range.endIdx);
  }, [episodes, ranges, activeRangeIdx, searchTerm]);

  const showServerTabs = availableServerEntries.length > 1;

  return (
    <div className="bg-background p-6 rounded-xl border border-zinc-800 space-y-6">
      {showServerTabs && (
        <div className="flex flex-wrap gap-2">
          {availableServerEntries.map(({ server, idx }) => {
            const isActive = idx === activeServerIdx;
            return (
              <button
                key={idx}
                onClick={() => onServerChange(idx)}
                className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold transition ${
                  isActive
                    ? "border border-primary text-primary"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {server.source ? (
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-black ${SOURCE_BADGE_CLASS[server.source]}`}
                  >
                    {getSourceBadge(server.source)}
                  </span>
                ) : null}
                <span>{stripSourcePrefix(server.server_name)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-lg font-bold text-white capitalize tracking-wider flex items-center gap-2">
          <Bars3CenterLeftIcon className="w-7 h-7 text-primary" />
          <span>Danh sách tập</span>
        </div>

        <div className="relative w-full sm:w-64 group">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Tìm tập phim..."
            aria-label="Tìm tập phim"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-9 pr-8 text-sm text-zinc-200 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              aria-label="Xóa tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-800 rounded-full"
            >
              <XMarkIcon className="w-4 h-4 text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      {ranges.length > 0 && !searchTerm && (
        <div className="flex flex-wrap gap-2 pb-6 border-b border-zinc-800/50">
          {ranges.map((range, idx) => (
            <button
              key={idx}
              onClick={() => setActiveRangeIdx(idx)}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                idx === activeRangeIdx
                  ? "bg-white text-black shadow-lg"
                  : "bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {filteredEpisodes.length > 0 ? (
          filteredEpisodes.map((sv) => {
            const progress =
              episodesProgress[getEpisodeProgressKey(sv)] ||
              episodesProgress[sv.slug];
            const isFinished = progress?.ep_is_finished || false;
            const isSelected = getEpisodeProgressKey(sv) === selectedEpisodeKey;
            const progressPercent =
              progress && progress.ep_duration > 0
                ? Math.min(
                    (progress.ep_last_time / progress.ep_duration) * 100,
                    100,
                  )
                : 0;

            return (
              <button
                key={`${sv.source || "unknown"}-${getEpisodeProgressKey(sv)}-${sv.slug}`}
                className={`group relative p-2 rounded hover:bg-primary transition flex items-center justify-center min-h-[2.5rem] ${
                  isSelected
                    ? "bg-primary"
                    : isFinished
                      ? "bg-zinc-800/60"
                      : "bg-zinc-800"
                }`}
                onClick={() => onSelect(sv)}
                disabled={isSelected}
              >
                <span className="text-sm font-bold truncate w-full text-center text-zinc-100 group-hover:text-white">
                  {sv.name}
                </span>

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
          <div className="col-span-full py-10 text-center text-zinc-600 italic text-sm">
            Không tìm thấy tập phim nào khớp với từ khóa...
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(WatchEpisodeSelector);

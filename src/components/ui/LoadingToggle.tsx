"use client";

import { KeyboardEvent } from "react";

interface LoadingToggleProps {
  checked: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  activeClassName?: string;
  "aria-label": string;
  "data-testid"?: string;
}

export default function LoadingToggle({
  checked,
  loading = false,
  disabled = false,
  onClick,
  size = "md",
  activeClassName = "bg-emerald-500",
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: LoadingToggleProps) {
  const isDisabled = disabled || loading;
  const trackSize = size === "sm" ? "w-8 h-4" : "w-11 h-6 sm:w-12 sm:h-6";
  const knobSize = size === "sm" ? "w-3 h-3 top-0.5 left-0.5" : "w-4 h-4 top-1 left-1";
  const translate = size === "sm" ? "translate-x-4" : "translate-x-5 sm:translate-x-6";

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (!isDisabled) onClick();
  };

  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      data-testid={dataTestId}
      disabled={isDisabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!isDisabled) onClick();
      }}
      onKeyDown={handleKeyDown}
      className={`${trackSize} rounded-full transition-all relative shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${checked ? activeClassName : "bg-zinc-700"}`}
    >
      <span
        className={`absolute ${knobSize} bg-white rounded-full transition-transform flex items-center justify-center ${checked ? translate : "translate-x-0"}`}
      >
        {loading && (
          <span className="w-2.5 h-2.5 border-2 border-zinc-300 border-t-red-600 rounded-full animate-spin" />
        )}
      </span>
    </button>
  );
}

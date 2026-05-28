import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VideoControls from "@/components/shared/VideoControls";

const baseProps = {
  isFollowed: false,
  isFollowLoading: false,
  toggleFollow: vi.fn(),
  isAutoNext: true,
  setIsAutoNext: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  prevEnabled: true,
  nextEnabled: true,
  isLightsOff: false,
  setIsLightsOff: vi.fn(),
};

describe("VideoControls", () => {
  it("shows manual sync button only in watch party mode and calls sync handler", () => {
    const onManualSync = vi.fn();

    const { rerender } = render(
      React.createElement(VideoControls, {
        ...baseProps,
        isWatchParty: false,
        onManualSync,
      }),
    );

    expect(screen.queryByRole("button", { name: "Đồng bộ tiến độ" })).toBeNull();

    rerender(
      React.createElement(VideoControls, {
        ...baseProps,
        isWatchParty: true,
        onManualSync,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ tiến độ" }));

    expect(onManualSync).toHaveBeenCalledTimes(1);
  });

  it("disables manual sync and spins icon while sync is pending", async () => {
    let resolveSync: () => void = () => {};
    const onManualSync = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSync = resolve;
        }),
    );

    render(
      React.createElement(VideoControls, {
        ...baseProps,
        isWatchParty: true,
        onManualSync,
      }),
    );

    const button = screen.getByRole("button", { name: "Đồng bộ tiến độ" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onManualSync).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button.querySelector("svg")?.classList.contains("animate-spin")).toBe(true);

    resolveSync();

    await waitFor(() => expect(button).not.toBeDisabled());
    expect(button.querySelector("svg")?.classList.contains("animate-spin")).toBe(false);
  });
});

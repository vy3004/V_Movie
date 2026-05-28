import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const readSource = (path: string) => readFileSync(join(root, path), "utf8");

describe("watch party chat overlay subscription", () => {
  it("keeps messages subscription inside ChatOverlay instead of WatchPartyView", () => {
    const view = readSource(
      "src/app/(main)/xem-chung/_components/WatchPartyView.tsx",
    );
    const overlay = readSource(
      "src/app/(main)/xem-chung/_components/ChatOverlay.tsx",
    );

    expect(view).not.toContain("selectMessages");
    expect(view).not.toContain("messages={messages}");
    expect(overlay).toContain("selectMessages");
    expect(overlay).toContain("useWatchPartyStore(selectMessages)");
  });

  it("detects new flying messages after capped chat history stops growing", () => {
    const overlay = readSource(
      "src/app/(main)/xem-chung/_components/ChatOverlay.tsx",
    );

    expect(overlay).toContain("prevLastMessageId");
    expect(overlay).not.toContain("prevMessagesLength");
    expect(overlay).not.toContain("messages.length > prevMessagesLength.current");
    expect(overlay).not.toContain("messages.slice(prevMessagesLength.current)");
  });

  it("passes chat permission state into fullscreen overlay", () => {
    const view = readSource(
      "src/app/(main)/xem-chung/_components/WatchPartyView.tsx",
    );

    expect(view).toContain("selectMyParticipant");
    expect(view).toContain("isOverlayChatMuted");
    expect(view).toContain("isMuted={isOverlayChatMuted}");
  });
});

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readSource = (path: string) => readFileSync(join(root, path), "utf8");

describe("watch party render stability", () => {
  it("uses stable callbacks for watch party player and chat props", () => {
    const source = readSource(
      "src/app/(main)/xem-chung/_components/WatchPartyView.tsx",
    );

    expect(source).toContain("const handlePlaySync = useCallback");
    expect(source).toContain("const handlePauseSync = useCallback");
    expect(source).toContain("const handleSeekSync = useCallback");
    expect(source).toContain("const handleChangeEpisode = useCallback");
    expect(source).toContain("const handleSendOverlayMessage = useCallback");
    expect(source).toContain("const handleProgress = useCallback");
    expect(source).toContain("const handleServerChange = useCallback");
    expect(source).toContain("onPlaySync={handlePlaySync}");
    expect(source).toContain("onPauseSync={handlePauseSync}");
    expect(source).toContain("onSeekSync={handleSeekSync}");
    expect(source).toContain("onChangeEpisode={handleChangeEpisode}");
    expect(source).toContain("onProgress={handleProgress}");
    expect(source).toContain("onServerChange={handleServerChange}");
    expect(source).toContain("onSendMessage={handleSendOverlayMessage}");
    expect(source).not.toContain('onPlaySync={(t) => sendControl("play", t)}');
    expect(source).not.toContain('onSendMessage={(msg) => {');
  });

  it("selects active voice count through primitive selector helper", () => {
    const source = readSource(
      "src/app/(main)/xem-chung/_components/members/MemberVoiceFooter.tsx",
    );

    expect(source).toContain("const selectCurrentUserId");
    expect(source).toContain("const selectActiveVoiceCount");
    expect(source).toContain("useWatchPartyStore(selectActiveVoiceCount)");
    expect(source).not.toContain("Object.values(state.presenceData).filter");
  });
});

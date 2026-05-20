import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { shouldReconnectDataChannel } from "@/stores/watch-party/data-channel-lifecycle";

const root = process.cwd();
const readSource = (path: string) => readFileSync(join(root, path), "utf8");

describe("watch party data channel lifecycle", () => {
  it.each(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"] as const)(
    "reconnects wp_data after %s",
    (status) => {
      expect(shouldReconnectDataChannel(status)).toBe(true);
    },
  );

  it("does not reconnect after successful subscription", () => {
    expect(shouldReconnectDataChannel("SUBSCRIBED")).toBe(false);
  });

  it("does not mark presence offline on generic pagehide events", () => {
    const source = readSource(
      "src/app/(main)/xem-chung/_components/WatchPartyRealtime.tsx",
    );

    expect(source).not.toContain("window.addEventListener(\"pagehide\"");
    expect(source).not.toContain("const handlePageHide = () => {\n      markOffline();\n    };");
    expect(source).toContain("markOfflineBeforeNavigation().finally");
  });

  it("does not send leave presence lease from ordinary effect cleanup", () => {
    const source = readSource(
      "src/app/(main)/xem-chung/_components/WatchPartyRealtime.tsx",
    );

    expect(source).toContain("markOfflineBeforeNavigation().finally");
    expect(source).toContain("sendPresenceLease(presenceStatusRef.current, \"leave\")");
    expect(source).not.toContain(
      "sendPresenceLease(presenceStatusRef.current, \"leave\").catch(() => {});",
    );
  });

  it("exits browser fullscreen before redirecting kicked participant", () => {
    const source = readSource(
      "src/app/(main)/xem-chung/_components/WatchPartyRealtime.tsx",
    );

    expect(source).toContain("redirectKickedParticipant");
    expect(source).toContain("document.fullscreenElement");
    expect(source).toContain("document.exitFullscreen");
    expect(source).toContain("router.replace(\"/xem-chung?kicked=1\")");
    expect(source.match(/router\.replace\(\"\/xem-chung\?kicked=1\"\)/g)).toHaveLength(1);
    expect(source.match(/redirectKickedParticipant\(\);/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

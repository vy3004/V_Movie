import { beforeEach, describe, expect, it } from "vitest";
import { useWatchPartyStore } from "@/stores/watch-party";

const makeChannel = (state: string) => ({ state }) as never;

describe("watch party room slice", () => {
  beforeEach(() => {
    useWatchPartyStore.setState({
      room: null,
      isLoading: false,
      error: null,
      user: null,
      dataChannel: null,
      dataChannelStatus: "closed",
      activeTab: "chat",
      isSidebarOpen: true,
      isSettingsModalOpen: false,
      isVoiceConnected: false,
      kickTarget: null,
      isKicked: false,
      openMenuId: null,
      isLoadingRoom: false,
      initialState: null,
    });
  });

  it("clears stale data channel when status leaves joined", () => {
    const channel = makeChannel("joined");

    useWatchPartyStore.getState().setDataChannel(channel);
    useWatchPartyStore.getState().setDataChannelStatus("joined");
    useWatchPartyStore.getState().setDataChannelStatus("closed");

    expect(useWatchPartyStore.getState().dataChannelStatus).toBe("closed");
    expect(useWatchPartyStore.getState().dataChannel).toBeNull();
  });

  it("marks data channel closed when channel is cleared", () => {
    const channel = makeChannel("joined");

    useWatchPartyStore.getState().setDataChannel(channel);
    useWatchPartyStore.getState().setDataChannel(null);

    expect(useWatchPartyStore.getState().dataChannelStatus).toBe("closed");
    expect(useWatchPartyStore.getState().dataChannel).toBeNull();
  });

  it("ignores stale channel status from previous data channel", () => {
    const previousChannel = makeChannel("closed");
    const currentChannel = makeChannel("joined");

    useWatchPartyStore.getState().setDataChannel(previousChannel);
    useWatchPartyStore.getState().setDataChannel(currentChannel);
    useWatchPartyStore.getState().setDataChannelStatus("closed", previousChannel);

    expect(useWatchPartyStore.getState().dataChannelStatus).toBe("joined");
    expect(useWatchPartyStore.getState().dataChannel).toBe(currentChannel);
  });
});

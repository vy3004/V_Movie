/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePlaybackRealtime } from "@/features/watch-party/playback-sync";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const createWrapper = (queryClient = createTestQueryClient()) => {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const createChannel = () => ({
  state: "joined",
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(function (this: any, callback: (status: string) => void) {
    callback("SUBSCRIBED");
    return this;
  }),
  send: vi.fn().mockResolvedValue({ error: null }),
});

describe("usePlaybackRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/watch-party?roomId=")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              room: { id: "room-123", room_code: "ABC123" },
              state: {
                status: "pause",
                time: 0,
                active_controller_id: "user-1",
                active_controller_name: "Host",
                version: 3,
                updated_at: Date.now(),
                calculated_at: Date.now(),
              },
            }),
        });
      }

      if (url.includes("/api/watch-party/sync")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              state: {
                status: "play",
                time: 12,
                active_controller_id: "user-1",
                active_controller_name: "Host",
                version: 4,
                updated_at: Date.now(),
              },
            }),
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("posts control to canonical sync API and broadcasts accepted state", async () => {
    const channel = createChannel();
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "user-1",
          () => true,
          () => true,
          supabase,
          vi.fn(),
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(supabase.channel).toHaveBeenCalled());

    act(() => result.current.sendControl("play", 12));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/watch-party/sync",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"requestId":"user-1-'),
        }),
      );
      const syncCall = vi.mocked(global.fetch).mock.calls.find(
        ([url]) => typeof url === "string" && url.includes("/api/watch-party/sync"),
      );
      const requestId = JSON.parse(syncCall?.[1]?.body as string).requestId;

      expect(channel.send).toHaveBeenCalledWith({
        type: "broadcast",
        event: "video_control",
        payload: expect.objectContaining({
          status: "play",
          action: "play",
          time: 12,
          activeControllerId: "user-1",
          activeControllerName: "Host",
          version: 4,
          senderId: "user-1",
          requestId,
          origin: "user",
        }),
      });
    });
  });

  it("ignores stale realtime state by version", async () => {
    const channel = createChannel();
    let videoHandler: ((event: { payload: unknown }) => void) | undefined;
    channel.on.mockImplementation((type: string, config: { event: string }, handler: any) => {
      if (type === "broadcast" && config.event === "video_control") videoHandler = handler;
      return channel;
    });
    const syncFromRemote = vi.fn();
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "user-1",
          () => true,
          () => true,
          supabase,
          syncFromRemote,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(videoHandler).toBeDefined());
    await waitFor(() => expect(result.current.activeControllerId).toBe("user-1"));

    act(() => {
      videoHandler?.({
        payload: {
          status: "play",
          action: "play",
          time: 20,
          version: 2,
          updatedAt: Date.now(),
          senderId: "user-2",
          origin: "user",
        },
      });
    });

    expect(syncFromRemote).not.toHaveBeenCalled();
  });

  it("ignores forged realtime state when sender is not active controller", async () => {
    const channel = createChannel();
    let videoHandler: ((event: { payload: unknown }) => void) | undefined;
    channel.on.mockImplementation((type: string, config: { event: string }, handler: any) => {
      if (type === "broadcast" && config.event === "video_control") videoHandler = handler;
      return channel;
    });
    const syncFromRemote = vi.fn();
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "user-1",
          () => true,
          () => true,
          supabase,
          syncFromRemote,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(videoHandler).toBeDefined());
    await waitFor(() => expect(result.current.activeControllerId).toBe("user-1"));

    act(() => {
      videoHandler?.({
        payload: {
          status: "play",
          action: "play",
          time: 90,
          activeControllerId: "user-1",
          activeControllerName: "Host",
          version: 99,
          updatedAt: Date.now(),
          senderId: "user-3",
          origin: "user",
        },
      });
    });

    expect(syncFromRemote).not.toHaveBeenCalled();
    expect(result.current.activeControllerId).toBe("user-1");
  });

  it("applies newer realtime state and updates active controller", async () => {
    const channel = createChannel();
    let videoHandler: ((event: { payload: unknown }) => void) | undefined;
    channel.on.mockImplementation((type: string, config: { event: string }, handler: any) => {
      if (type === "broadcast" && config.event === "video_control") videoHandler = handler;
      return channel;
    });
    const syncFromRemote = vi.fn();
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "user-1",
          () => true,
          () => true,
          supabase,
          syncFromRemote,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(videoHandler).toBeDefined());
    await waitFor(() => expect(result.current.activeControllerId).toBe("user-1"));

    act(() => {
      videoHandler?.({
        payload: {
          status: "pause",
          action: "pause",
          time: 30,
          activeControllerId: "user-2",
          activeControllerName: "Guest",
          version: 4,
          updatedAt: Date.now(),
          senderId: "user-2",
          origin: "user",
        },
      });
    });

    expect(syncFromRemote).toHaveBeenCalledWith("pause", 30);
    await waitFor(() => {
      expect(result.current.activeControllerId).toBe("user-2");
      expect(result.current.activeControllerName).toBe("Guest");
    });
  });

  it("ignores stale accepted sync response after newer realtime state", async () => {
    const channel = createChannel();
    let videoHandler: ((event: { payload: unknown }) => void) | undefined;
    channel.on.mockImplementation((type: string, config: { event: string }, handler: any) => {
      if (type === "broadcast" && config.event === "video_control") videoHandler = handler;
      return channel;
    });
    let resolveSync: ((value: unknown) => void) | undefined;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/watch-party?roomId=")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              room: { id: "room-123", room_code: "ABC123" },
              state: {
                status: "pause",
                time: 0,
                active_controller_id: "user-1",
                active_controller_name: "Host",
                version: 3,
                updated_at: Date.now(),
                calculated_at: Date.now(),
              },
            }),
        });
      }

      if (url.includes("/api/watch-party/sync")) {
        return new Promise((resolve) => {
          resolveSync = resolve;
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "user-1",
          () => true,
          () => true,
          supabase,
          vi.fn(),
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(videoHandler).toBeDefined());
    await waitFor(() => expect(result.current.activeControllerId).toBe("user-1"));

    act(() => result.current.sendControl("play", 12));

    act(() => {
      videoHandler?.({
        payload: {
          status: "pause",
          action: "pause",
          time: 20,
          activeControllerId: "user-2",
          activeControllerName: "Guest",
          version: 5,
          updatedAt: Date.now(),
          senderId: "user-2",
          origin: "user",
        },
      });
    });

    await waitFor(() => expect(result.current.activeControllerId).toBe("user-2"));

    act(() => {
      resolveSync?.({
        ok: true,
        json: () =>
          Promise.resolve({
            state: {
              status: "play",
              time: 12,
              active_controller_id: "user-1",
              active_controller_name: "Host",
              version: 4,
              updated_at: Date.now(),
            },
          }),
      });
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/watch-party/sync",
      expect.any(Object),
    ));
    expect(result.current.activeControllerId).toBe("user-2");
    expect(channel.send).not.toHaveBeenCalledWith({
      type: "broadcast",
      event: "video_control",
      payload: expect.objectContaining({ version: 4 }),
    });
  });

  it("buffers remote control while local control waits for server acceptance", async () => {
    const channel = createChannel();
    let videoHandler: ((event: { payload: unknown }) => void) | undefined;
    channel.on.mockImplementation((type: string, config: { event: string }, handler: any) => {
      if (type === "broadcast" && config.event === "video_control") videoHandler = handler;
      return channel;
    });
    let resolveSync: ((value: unknown) => void) | undefined;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/watch-party?roomId=")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              room: { id: "room-123", room_code: "ABC123" },
              state: {
                status: "pause",
                time: 10,
                active_controller_id: "user-2",
                active_controller_name: "Guest",
                version: 4,
                updated_at: Date.now(),
                calculated_at: Date.now(),
              },
            }),
        });
      }

      if (url.includes("/api/watch-party/sync")) {
        return new Promise((resolve) => {
          resolveSync = resolve;
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    const syncFromRemote = vi.fn();
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "user-1",
          () => true,
          () => true,
          supabase,
          syncFromRemote,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(videoHandler).toBeDefined());
    await waitFor(() => expect(result.current.activeControllerId).toBe("user-2"));

    act(() => result.current.sendControl("seek", 60));

    act(() => {
      videoHandler?.({
        payload: {
          status: "pause",
          action: "pause",
          time: 10,
          activeControllerId: "user-2",
          activeControllerName: "Guest",
          version: 5,
          updatedAt: Date.now(),
          senderId: "user-2",
          origin: "user",
        },
      });
    });

    expect(syncFromRemote).not.toHaveBeenCalledWith("pause", 10);

    act(() => {
      resolveSync?.({
        ok: true,
        json: () =>
          Promise.resolve({
            state: {
              status: "pause",
              time: 60,
              active_controller_id: "user-1",
              active_controller_name: "Host",
              version: 6,
              updated_at: Date.now(),
            },
          }),
      });
    });

    await waitFor(() => expect(result.current.activeControllerId).toBe("user-1"));
    expect(syncFromRemote).not.toHaveBeenCalledWith("pause", 10);
  });

  it("keeps accepted controller when room refetch returns same-version stale controller", async () => {
    const channel = createChannel();
    let resolveSync: ((value: unknown) => void) | undefined;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/watch-party?roomId=")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              room: { id: "room-123", room_code: "ABC123" },
              state: {
                status: "pause",
                time: 10,
                active_controller_id: "user-2",
                active_controller_name: "Guest",
                version: 4,
                updated_at: Date.now(),
                calculated_at: Date.now(),
              },
            }),
        });
      }

      if (url.includes("/api/watch-party/sync")) {
        return new Promise((resolve) => {
          resolveSync = resolve;
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    const queryClient = createTestQueryClient();
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "user-1",
          () => true,
          () => true,
          supabase,
          vi.fn(),
        ),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.activeControllerId).toBe("user-2"));

    act(() => result.current.sendControl("seek", 60));

    act(() => {
      resolveSync?.({
        ok: true,
        json: () =>
          Promise.resolve({
            requestId: JSON.parse(
              vi.mocked(global.fetch).mock.calls.find(
                ([url]) => typeof url === "string" && url.includes("/api/watch-party/sync"),
              )?.[1]?.body as string,
            ).requestId,
            state: {
              status: "pause",
              time: 60,
              active_controller_id: "user-1",
              active_controller_name: "Host",
              version: 6,
              updated_at: Date.now(),
            },
          }),
      });
    });

    await waitFor(() => expect(result.current.activeControllerId).toBe("user-1"));

    queryClient.setQueryData(["watch-party", "room-123"], {
      room: { id: "room-123", room_code: "ABC123" },
      state: {
        status: "pause",
        time: 10,
        active_controller_id: "user-2",
        active_controller_name: "Guest",
        version: 6,
        updated_at: Date.now(),
        calculated_at: Date.now(),
      },
    });

    await waitFor(() => {
      expect(result.current.activeControllerId).toBe("user-1");
      expect(result.current.activeControllerName).toBe("Host");
    });
  });

  it("keeps accepted controller when old controller replies to reconnect sync", async () => {
    const channel = createChannel();
    let videoHandler: ((event: { payload: unknown }) => void) | undefined;
    channel.on.mockImplementation((type: string, config: { event: string }, handler: any) => {
      if (type === "broadcast" && config.event === "video_control") videoHandler = handler;
      return channel;
    });
    let resolveSync: ((value: unknown) => void) | undefined;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/watch-party?roomId=")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              room: { id: "room-123", room_code: "ABC123" },
              state: {
                status: "pause",
                time: 10,
                active_controller_id: "user-2",
                active_controller_name: "Guest",
                version: 4,
                updated_at: Date.now(),
                calculated_at: Date.now(),
              },
            }),
        });
      }

      if (url.includes("/api/watch-party/sync")) {
        return new Promise((resolve) => {
          resolveSync = resolve;
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "user-1",
          () => true,
          () => true,
          supabase,
          vi.fn(),
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(videoHandler).toBeDefined());
    await waitFor(() => expect(result.current.activeControllerId).toBe("user-2"));

    act(() => result.current.sendControl("seek", 60));

    act(() => {
      resolveSync?.({
        ok: true,
        json: () =>
          Promise.resolve({
            requestId: JSON.parse(
              vi.mocked(global.fetch).mock.calls.find(
                ([url]) => typeof url === "string" && url.includes("/api/watch-party/sync"),
              )?.[1]?.body as string,
            ).requestId,
            state: {
              status: "pause",
              time: 60,
              active_controller_id: "user-1",
              active_controller_name: "Host",
              version: 6,
              updated_at: Date.now(),
            },
          }),
      });
    });

    await waitFor(() => expect(result.current.activeControllerId).toBe("user-1"));

    const syncRequest = vi.mocked(channel.send).mock.calls.find(
      ([message]) => message.event === "request_sync_from_host",
    )?.[0].payload.requestId;

    act(() => {
      videoHandler?.({
        payload: {
          status: "pause",
          action: "pause",
          time: 60,
          activeControllerId: "user-2",
          activeControllerName: "Guest",
          version: 7,
          updatedAt: Date.now(),
          senderId: "user-2",
          requestId: syncRequest,
          origin: "system",
        },
      });
    });

    expect(result.current.activeControllerId).toBe("user-1");
    expect(result.current.activeControllerName).toBe("Host");
  });

  it("ignores stale same-version heartbeat after accepted seek", async () => {
    const channel = createChannel();
    let heartbeatHandler: ((event: { payload: unknown }) => void) | undefined;
    channel.on.mockImplementation((type: string, config: { event: string }, handler: any) => {
      if (type === "broadcast" && config.event === "heartbeat_sync") heartbeatHandler = handler;
      return channel;
    });
    const syncHeartbeat = vi.fn();
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "host-1",
          () => true,
          () => true,
          supabase,
          vi.fn(),
          undefined,
          undefined,
          syncHeartbeat,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(heartbeatHandler).toBeDefined());

    act(() => {
      channel.on.mock.calls
        .find(([, config]) => config.event === "video_control")?.[2]({
          payload: {
            status: "pause",
            action: "seek",
            time: 60,
            activeControllerId: "user-1",
            activeControllerName: "Guest",
            version: 4,
            updatedAt: Date.now(),
            senderId: "user-1",
            origin: "user",
          },
        });
    });

    await waitFor(() => expect(result.current.activeControllerId).toBe("user-1"));

    act(() => {
      heartbeatHandler?.({
        payload: {
          time: 10,
          senderId: "user-1",
          controllerId: "user-1",
          version: 4,
          status: "pause",
          isPaused: true,
        },
      });
    });

    expect(syncHeartbeat).not.toHaveBeenCalled();
  });

  it("clears pending local control after rejected sync response", async () => {
    const channel = createChannel();
    let heartbeatHandler: ((event: { payload: unknown }) => void) | undefined;
    channel.on.mockImplementation((type: string, config: { event: string }, handler: any) => {
      if (type === "broadcast" && config.event === "heartbeat_sync") heartbeatHandler = handler;
      return channel;
    });
    let resolveSync: ((value: unknown) => void) | undefined;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/watch-party?roomId=")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              room: { id: "room-123", room_code: "ABC123" },
              state: {
                status: "pause",
                time: 10,
                active_controller_id: "user-2",
                active_controller_name: "Guest",
                version: 4,
                updated_at: Date.now(),
                calculated_at: Date.now(),
              },
            }),
        });
      }

      if (url.includes("/api/watch-party/sync")) {
        return new Promise((resolve) => {
          resolveSync = resolve;
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    const syncHeartbeat = vi.fn();
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "user-1",
          () => true,
          () => true,
          supabase,
          vi.fn(),
          undefined,
          undefined,
          syncHeartbeat,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(heartbeatHandler).toBeDefined());
    await waitFor(() => expect(result.current.activeControllerId).toBe("user-2"));

    act(() => result.current.sendControl("seek", 60));

    act(() => {
      resolveSync?.({ ok: false, json: () => Promise.resolve({ error: "denied" }) });
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/watch-party/sync",
      expect.any(Object),
    ));

    act(() => {
      heartbeatHandler?.({
        payload: {
          time: 10,
          senderId: "user-2",
          controllerId: "user-2",
          version: 4,
          status: "pause",
          isPaused: true,
        },
      });
    });

    expect(syncHeartbeat).toHaveBeenCalledWith(10, true);
  });

  it("only sends heartbeat from active controller", async () => {
    const channel = createChannel();
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as any;

    const { result } = renderHook(
      () =>
        usePlaybackRealtime(
          "room-123",
          "user-1",
          () => true,
          () => true,
          supabase,
          vi.fn(),
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.activeControllerId).toBe("user-1"));

    act(() => result.current.sendHeartbeat(10, true));

    await waitFor(() => {
      expect(channel.send).toHaveBeenCalledWith({
        type: "broadcast",
        event: "heartbeat_sync",
        payload: expect.objectContaining({
          time: 10,
          senderId: "user-1",
          controllerId: "user-1",
          version: 3,
          status: "pause",
          isPaused: true,
        }),
      });
    });
  });
});


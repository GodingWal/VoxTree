import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cloneVoice,
  deleteVoice,
  generateSpeech,
  getChatterboxServiceUrl,
} from "@/lib/chatterbox";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CHATTERBOX_SERVICE_URL", "http://voice.local:8001/");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("chatterbox service url", () => {
  it("uses CHATTERBOX_SERVICE_URL and trims trailing slashes", () => {
    expect(getChatterboxServiceUrl()).toBe("http://voice.local:8001");
  });
  it("defaults to localhost:8001", () => {
    vi.stubEnv("CHATTERBOX_SERVICE_URL", "");
    expect(getChatterboxServiceUrl()).toBe("http://localhost:8001");
  });
});

describe("cloneVoice", () => {
  it("posts multipart name + file to /voices/clone and returns the voice id", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { voice_id: "cb_abc", name: "Gran" }));
    const id = await cloneVoice(Buffer.from("audio-bytes"), "Gran");
    expect(id).toBe("cb_abc");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://voice.local:8001/voices/clone");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("name")).toBe("Gran");
    const file = (init.body as FormData).get("file") as File;
    expect(file).toBeInstanceOf(Blob);
    expect(file.name).toBe("sample.mp3");
  });

  it("throws with the service error body on failure", async () => {
    fetchMock.mockResolvedValue(new Response("bad audio", { status: 400 }));
    await expect(cloneVoice(Buffer.from("x"), "Gran")).rejects.toThrow(/400/);
  });
});

describe("generateSpeech", () => {
  it("posts JSON to /tts and returns the audio bytes", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/wav" },
      })
    );
    const audio = await generateSpeech("cb_abc", "Hello there");
    expect(Buffer.isBuffer(audio)).toBe(true);
    expect([...audio]).toEqual([1, 2, 3]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://voice.local:8001/tts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      voice_id: "cb_abc",
      text: "Hello there",
    });
  });

  it("throws on a service error (e.g. unknown voice)", async () => {
    fetchMock.mockResolvedValue(new Response("voice not found", { status: 400 }));
    await expect(generateSpeech("cb_nope", "Hi")).rejects.toThrow(/400/);
  });

  it("rejects simulated voice ids in production without calling the service", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(generateSpeech("simulated_voice_id_old", "Hi")).rejects.toThrow(
      "production"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("deleteVoice", () => {
  it("issues DELETE /voices/:id", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await deleteVoice("cb_abc");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://voice.local:8001/voices/cb_abc");
    expect(init.method).toBe("DELETE");
  });

  it("treats 404 as success (already deleted)", async () => {
    fetchMock.mockResolvedValue(new Response("gone", { status: 404 }));
    await expect(deleteVoice("cb_gone")).resolves.toBeUndefined();
  });

  it("throws on other errors", async () => {
    fetchMock.mockResolvedValue(new Response("bad id", { status: 400 }));
    await expect(deleteVoice("!!")).rejects.toThrow(/400/);
  });
});

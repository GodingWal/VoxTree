import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cloneVoice,
  convertSpeech,
  deleteVoice,
  getSeedvcServiceUrl,
} from "@/lib/seedvc";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SEEDVC_SERVICE_URL", "http://voice.local:8001/");
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

describe("seedvc service url", () => {
  it("uses SEEDVC_SERVICE_URL and trims trailing slashes", () => {
    expect(getSeedvcServiceUrl()).toBe("http://voice.local:8001");
  });
  it("defaults to localhost:8001", () => {
    vi.stubEnv("SEEDVC_SERVICE_URL", "");
    expect(getSeedvcServiceUrl()).toBe("http://localhost:8001");
  });
});

describe("cloneVoice", () => {
  it("posts multipart name + file to /voices/clone and returns the voice id", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { voice_id: "sv_abc", name: "Gran" }));
    const id = await cloneVoice(Buffer.from("audio-bytes"), "Gran");
    expect(id).toBe("sv_abc");
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

describe("convertSpeech", () => {
  it("posts multipart voice_id + source file to /convert and returns the audio bytes", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/wav" },
      })
    );
    const audio = await convertSpeech("sv_abc", Buffer.from("source-performance"));
    expect(Buffer.isBuffer(audio)).toBe(true);
    expect([...audio]).toEqual([1, 2, 3]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://voice.local:8001/convert");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("voice_id")).toBe("sv_abc");
    const source = form.get("source") as File;
    expect(source).toBeInstanceOf(Blob);
    expect(source.name).toBe("source.wav");
    expect(await source.text()).toBe("source-performance");
  });

  it("passes conversion options as form fields", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([9]), { status: 200 }));
    await convertSpeech("sv_abc", Buffer.from("src"), { diffusionSteps: 30, f0Condition: true });
    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get("diffusion_steps")).toBe("30");
    expect(form.get("f0_condition")).toBe("true");
  });

  it("throws on a service error (e.g. unknown voice)", async () => {
    fetchMock.mockResolvedValue(new Response("voice not found", { status: 400 }));
    await expect(convertSpeech("sv_nope", Buffer.from("src"))).rejects.toThrow(/400/);
  });

  it("rejects empty source audio without calling the service", async () => {
    await expect(convertSpeech("sv_abc", Buffer.alloc(0))).rejects.toThrow(
      /seedvc_requires_source_audio/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects simulated voice ids in production without calling the service", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      convertSpeech("simulated_voice_id_old", Buffer.from("src"))
    ).rejects.toThrow("production");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("deleteVoice", () => {
  it("issues DELETE /voices/:id", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await deleteVoice("sv_abc");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://voice.local:8001/voices/sv_abc");
    expect(init.method).toBe("DELETE");
  });

  it("treats 404 as success (already deleted)", async () => {
    fetchMock.mockResolvedValue(new Response("gone", { status: 404 }));
    await expect(deleteVoice("sv_gone")).resolves.toBeUndefined();
  });

  it("throws on other errors", async () => {
    fetchMock.mockResolvedValue(new Response("bad id", { status: 400 }));
    await expect(deleteVoice("!!")).rejects.toThrow(/400/);
  });
});

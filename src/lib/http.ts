import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return privateJson({ error: error.issues[0]?.message ?? "Check your input.", code: "invalid_input" }, 400);
  }
  if (error instanceof AppError) {
    return privateJson({ error: error.message, code: error.code }, error.status);
  }
  return privateJson({ error: "Something went wrong. Please try again.", code: "unexpected" }, 500);
}

export async function readJson(request: Request, maxBytes = 4096): Promise<unknown> {
  const tooLarge = () => new AppError(413, "invalid_input", "This request is too large.");
  if (Number(request.headers.get("content-length")) > maxBytes) throw tooLarge();

  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "invalid_input", "Provide a report request.");

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5_000)]);
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let body = "";
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (!signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        cancel();
        throw tooLarge();
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    if (signal.aborted) throw new AppError(408, "timeout", "The report request took too long. Please try again.");
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof AppError) throw error;
    cancel();
    throw new AppError(400, "invalid_input", "Provide a valid JSON report request.");
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

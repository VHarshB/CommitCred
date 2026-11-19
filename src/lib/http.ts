import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ error: error.issues[0]?.message ?? "Check your input.", code: "invalid_input" }, { status: 400 });
  }
  if (error instanceof AppError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return Response.json({ error: "Something went wrong. Please try again.", code: "unexpected" }, { status: 500 });
}

export async function readJson(request: Request, maxBytes = 4096): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "invalid_input", "Provide a report request.");

  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new AppError(413, "invalid_input", "This request is too large.");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "invalid_input", "Provide a valid JSON report request.");
  } finally {
    reader.releaseLock();
  }
}

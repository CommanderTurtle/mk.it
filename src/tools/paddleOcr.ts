import type { Result, WorkerOptions } from "../../public/ocr/paddle/ppocr";

type PaddleModule = typeof import("../../public/ocr/paddle/ppocr");

/** Loaded only by the Paddle-OCR button; each scan releases its own worker. */
export async function recognizeWithPaddle(
	image: File,
	signal: AbortSignal,
	logger: NonNullable<WorkerOptions["logger"]>
): Promise<Result["data"]> {
	signal.throwIfAborted();
	// Vite must leave this self-contained bundle and its relative worker/model
	// paths intact, including when the studio is hosted below /make/.
	const url = `${import.meta.env.BASE_URL}ocr/paddle/ppocr.js`;
	const { createWorker } = await import(/* @vite-ignore */ url) as PaddleModule;
	signal.throwIfAborted();
	const worker = await createWorker("multi", undefined, {
		backend: "wasm",
		numThreads: 1,
		timeoutMs: 120_000,
		signal,
		logger
	});
	try {
		signal.throwIfAborted();
		return (await worker.recognize(image, { signal })).data;
	} finally {
		await worker.terminate();
	}
}

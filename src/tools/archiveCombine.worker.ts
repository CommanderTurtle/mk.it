import { combineArchive } from "./archiveCombine";

self.onmessage = async ({ data }: MessageEvent<File>) => {
	try {
		self.postMessage({ result: await combineArchive(data) });
	} catch (error) {
		self.postMessage({ error: error instanceof Error ? error.message : String(error) });
	}
};

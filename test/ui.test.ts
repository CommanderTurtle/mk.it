import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import JSZip from "jszip";
import puppeteer, { type Browser, type Page } from "puppeteer";

let browser: Browser;
let page: Page;

const server = Bun.serve({
	port: 0,
	async fetch(request) {
		let path = new URL(request.url).pathname.replace(/^\/convert\/?/, "") || "index.html";
		path = path.replaceAll("..", "");
		const file = Bun.file(`${import.meta.dir}/../dist/${path}`);
		if (!(await file.exists())) return new Response("Not Found", { status: 404 });
		return new Response(file);
	}
});

async function clickButtonContaining(scope: string, text: string) {
	await page.evaluate((selector, expected) => {
		const button = [...document.querySelectorAll<HTMLButtonElement>(`${selector} button`)]
			.find(candidate => candidate.textContent?.includes(expected));
		if (!button) throw new Error(`Missing button containing ${expected}`);
		button.click();
	}, scope, text);
}

beforeAll(async () => {
	browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
	page = await browser.newPage();
	const ready = new Promise<void>(resolve => {
		page.on("console", message => {
			if (message.text() === "Built initial format list.") resolve();
		});
	});
	await page.goto(`http://localhost:${server.port}/convert/index.html`);
	await ready;
}, 60_000);

afterAll(async () => {
	await browser?.close();
	server.stop();
});

describe("four-tool home", () => {
	test("keeps the original converter and exposes the three new tools", async () => {
		const text = await page.$eval(".home-shell", element => element.textContent || "");
		expect(text).toContain("Convert a file");
		expect(text).toContain("Base64 file");
		expect(text).toContain("Image OCR");
		expect(text).toContain("Archive to Markdown");
		if (process.env.CAPTURE_UI) {
			await page.screenshot({ path: process.env.CAPTURE_UI, fullPage: true });
		}
	});

	test("decodes base64 and hands it a native input format", async () => {
		await page.type(".base64-panel textarea", "data:text/plain;base64,SGVsbG8gZnJvbSBicm93c2Vy");
		await clickButtonContaining(".base64-panel", "Done");
		await page.waitForSelector(".decoded-summary");
		const summary = await page.$eval(".decoded-summary", element => element.textContent || "");
		expect(summary).toContain("18 bytes");
		expect(await page.$eval(".base64-details select", select => select.options.length)).toBeGreaterThan(10);
		expect(await page.$eval(".base64-details", element => element.textContent || "")).toContain("Convert");
	});

	test("combines an uploaded ZIP and switches between pretty and raw", async () => {
		await page.evaluate(() => {
			const button = [...document.querySelectorAll<HTMLButtonElement>(".home-route-card")]
				.find(candidate => candidate.textContent?.includes("Archive to Markdown"));
			button?.click();
		});
		await page.waitForSelector(".combine-upload");

		const zip = new JSZip();
		zip.file("src/index.js", "console.log('browser test');\n");
		zip.file("native/tool.dll", new Uint8Array([77, 90, 0, 1]));
		const bytes = [...await zip.generateAsync({ type: "uint8array" })];
		await page.evaluate(data => {
			const input = document.querySelector<HTMLInputElement>(".combine-upload input");
			if (!input) throw new Error("Missing archive input");
			const transfer = new DataTransfer();
			transfer.items.add(new File([new Uint8Array(data)], "fixture.zip", { type: "application/zip" }));
			input.files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, bytes);

		await page.waitForSelector(".combine-pretty article");
		const pretty = await page.$eval(".combine-pretty", element => element.textContent || "");
		expect(pretty).toContain("src/index.js");
		expect(pretty).toContain("native/tool.dll");
		expect(pretty).toContain("omitted");

		await clickButtonContaining(".combine-actions", "Render raw");
		await page.waitForSelector(".combine-raw");
		const raw = await page.$eval<HTMLTextAreaElement>(".combine-raw", element => element.value);
		expect(raw).toContain("```javascript");
		expect(raw).toContain("(omitted — binary file");
	});

	test("opens OCR with every installed image extension exposed", async () => {
		await clickButtonContaining(".tool-header", "All tools");
		await page.waitForSelector(".home-shell");
		await page.evaluate(() => {
			const button = [...document.querySelectorAll<HTMLButtonElement>(".home-route-card")]
				.find(candidate => candidate.textContent?.includes("Image OCR"));
			button?.click();
		});
		await page.waitForSelector(".ocr-upload input");
		const accept = await page.$eval<HTMLInputElement>(".ocr-upload input", input => input.accept);
		expect(accept).toContain("image/*");
		expect(accept).toContain(".png");
		expect(accept).toContain(".tiff");
	});

	if (process.env.RUN_OCR_E2E === "1") {
		test("recognizes a browser-generated image with the real WebAssembly worker", async () => {
			const ocrRequests: string[] = [];
			const recordRequest = (request: { url(): string }) => ocrRequests.push(request.url());
			page.on("request", recordRequest);
			await page.evaluate(() => {
				const canvas = document.createElement("canvas");
				canvas.width = 900;
				canvas.height = 260;
				const context = canvas.getContext("2d");
				if (!context) throw new Error("Canvas unavailable");
				context.fillStyle = "white";
				context.fillRect(0, 0, canvas.width, canvas.height);
				context.fillStyle = "black";
				context.font = "bold 96px Arial";
				context.fillText("HELLO 123", 95, 165);
				canvas.toBlob(blob => {
					if (!blob) throw new Error("PNG encoding failed");
					const input = document.querySelector<HTMLInputElement>(".ocr-upload input");
					if (!input) throw new Error("OCR input unavailable");
					const transfer = new DataTransfer();
					transfer.items.add(new File([blob], "ocr-smoke.png", { type: "image/png" }));
					input.files = transfer.files;
					input.dispatchEvent(new Event("change", { bubbles: true }));
				}, "image/png");
			});
			await page.waitForSelector(".ocr-source-preview img");
			await clickButtonContaining(".ocr-actions", "Run OCR");
			await page.waitForSelector(".ocr-results", { timeout: 120_000 });
			const text = await page.$eval<HTMLTextAreaElement>(".ocr-result-panel textarea", element => element.value);
			expect(text.replace(/\s+/g, " ").trim()).toContain("HELLO 123");
			const iframe = await page.$(".ocr-result-panel iframe");
			const frame = await iframe?.contentFrame();
			expect(await frame?.$$eval(".word", words => words.length)).toBeGreaterThan(0);
			page.off("request", recordRequest);
			expect(ocrRequests.some(url => url.includes("/js/tesseract/worker.min.js"))).toBeTrue();
			expect(ocrRequests.some(url => url.includes("/tesseract-lang/eng.traineddata.gz"))).toBeTrue();
			expect(ocrRequests.filter(url => /jsdelivr|tesseract\.projectnaptha/i.test(url))).toEqual([]);
		}, 150_000);
	}
});

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import JSZip from "jszip";
import puppeteer, { type Browser, type Page } from "puppeteer";

import { shareUrl } from "../src/tools/share";
import { lnkrEditUrl, type LnkrKind } from "../src/tools/lnkr";

let browser: Browser;
let page: Page;

const server = Bun.serve({
	port: 0,
	async fetch(request) {
		let path = new URL(request.url).pathname.replace(/^\/make\/?/, "") || "index.html";
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
	await page.goto(`http://localhost:${server.port}/make/index.html`);
	await ready;
}, 60_000);

afterAll(async () => {
	await browser?.close();
	server.stop();
});

describe("four-tool home", () => {
	test("emits every runtime URL under the mk.it base", async () => {
		const dist = `${import.meta.dir}/../dist`;
		const index = await Bun.file(`${dist}/index.html`).text();
		expect(index).toContain('href="/make/');
		expect(index).toContain('src="/make/');
		expect(index).toContain("https://app.shel.sh/make/");

		const textAssets = new Bun.Glob("**/*.{html,js}");
		for await (const path of textAssets.scan({ cwd: dist, absolute: true })) {
			expect(await Bun.file(path).text()).not.toContain("/convert/");
		}
	});

	test("keeps the original converter and exposes the three new tools", async () => {
		const text = await page.$eval(".home-shell", element => element.textContent || "");
		expect(text).toContain("mk.it");
		expect(text).toContain("Convert a file");
		expect(text).toContain("Base64 file");
		expect(text).toContain("Image OCR");
		expect(text).toContain("Archive to Markdown");
		if (process.env.CAPTURE_UI) {
			await page.screenshot({ path: process.env.CAPTURE_UI, fullPage: true });
		}
	});

	test("links to sibling projects in new tabs with the Webclip tooltip", async () => {
		const links = await page.$$eval(".home-header .project-links a", anchors => anchors.map(anchor => ({
			label: anchor.textContent, href: anchor.getAttribute("href"),
			target: anchor.getAttribute("target"), rel: anchor.getAttribute("rel"), title: anchor.getAttribute("title")
		})));
		expect(links).toEqual([
			{ label: "/lnkr/", href: "https://a.shel.sh/", target: "_blank", rel: "noopener noreferrer", title: null },
			{ label: "webclip", href: "https://app.shel.sh/webclip", target: "_blank", rel: "noopener noreferrer", title: "for docx/ppt/epub/csv and more to Markdown" }
		]);
		await page.setViewport({ width: 375, height: 812 });
		expect(await page.$eval(".project-links", element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
		await page.setViewport({ width: 800, height: 600 });
	});

	test("encodes an uploaded file as MIME data URL or raw Base64 without changing its bytes", async () => {
		await page.evaluate(() => {
			const input = document.querySelector<HTMLInputElement>(".base64-file-picker");
			if (!input) throw new Error("Missing Base64 file input");
			const transfer = new DataTransfer();
			transfer.items.add(new File([Uint8Array.of(0, 255, 1, 2)], "bytes.bin"));
			input.files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		});
		await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>(".base64-panel textarea")?.value === "data:application/octet-stream;base64,AP8BAg==");
		expect(await page.$eval(".encoded-file-summary", element => element.textContent || "")).toContain("4 bytes");
		await page.click(".base64-mime-toggle input");
		await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>(".base64-panel textarea")?.value === "AP8BAg==");
		await page.$eval(".base64-panel textarea", textarea => {
			textarea.value = "";
			textarea.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await page.click(".base64-mime-toggle input");
	});

	test("decodes base64 and hands it a native input format", async () => {
		await page.type(".base64-panel textarea", "data:text/plain;base64,SGVsbG8gZnJvbSBicm93c2Vy");
		await clickButtonContaining(".base64-panel", "Done");
		await page.waitForSelector(".decoded-summary");
		const summary = await page.$eval(".decoded-summary", element => element.textContent || "");
		expect(summary).toContain("18 bytes");
		expect(await page.$eval(".base64-details select", select => select.options.length)).toBeGreaterThan(10);
		expect(await page.$eval(".base64-details", element => element.textContent || "")).toContain("Convert");
		expect(await page.$eval(".base64-details", element => element.textContent || "")).toContain("Share");
	});

	test("opens a fragment-shared SVG with highlighted source and an expandable native preview", async () => {
		await clickButtonContaining(".base64-details", "Reset");
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="blue"/></svg>';
		const payload = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
		await page.$eval(".base64-panel textarea", (textarea, value) => {
			textarea.value = value;
			textarea.dispatchEvent(new Event("input", { bubbles: true }));
		}, payload);
		await clickButtonContaining(".base64-panel", "Done");
		await clickButtonContaining(".base64-details", "Share");
		await page.waitForSelector(".share-preview img");
		await page.waitForSelector(".share-hashes button");
		expect(new URL(page.url()).hash).toStartWith("#share:");
		const checksums = await page.$$eval(".share-hashes button", buttons => buttons.map(button => button.textContent || ""));
		expect(checksums).toHaveLength(3);
		expect(checksums[0]).toMatch(/SHA-256[a-f0-9]{64}/);
		expect(checksums[1]).toMatch(/MD5[a-f0-9]{32}/);
		expect(checksums[2]).toMatch(/SHA-1[a-f0-9]{40}/);
		expect(await page.$eval(".share-source", element => element.textContent || "")).toContain("View source code");
		expect(await page.$eval(".share-source code", element => element.innerHTML)).toContain("hljs-tag");
		expect(await page.$('button[title="Open source in ln.kr in a new tab"]')).toBeNull();
		await page.click('.share-preview button[title="Open interactive pan-and-zoom image viewer"]');
		await page.waitForFunction(() => [...document.body.children].some(element => (element as HTMLElement).style.zIndex === "999999"));
		const interactive = await page.evaluate(() => {
			const overlay = [...document.body.children].find(element => (element as HTMLElement).style.zIndex === "999999") as HTMLElement | undefined;
			if (!overlay) throw new Error("Interactive viewer did not open");
			const buttons = [...overlay.querySelectorAll<HTMLButtonElement>("button")];
			buttons.find(button => button.textContent === "+")?.click();
			const image = overlay.querySelector<HTMLImageElement>("img");
			const source = image?.src || "";
			const transform = image?.style.transform || "";
			buttons.find(button => button.textContent === "✕")?.click();
			return { source, transform, stillConnected: overlay.isConnected };
		});
		expect(interactive.source).toStartWith("data:image/svg+xml;base64,");
		expect(interactive.transform).toContain("scale(1.25)");
		expect(interactive.stillConnected).toBe(false);
		if (process.env.CAPTURE_SHARE_UI) {
			await page.screenshot({ path: process.env.CAPTURE_SHARE_UI, fullPage: true });
		}
		await page.click('.share-preview button[title="Expand preview"]');
		await page.waitForFunction(() => document.querySelector<HTMLDialogElement>(".share-preview-dialog")?.open === true);
		await page.click(".share-preview-dialog header button");
		await clickButtonContaining(".tool-header", "All tools");
		await page.waitForSelector(".home-shell");
		expect(new URL(page.url()).hash).toBe("");
	});

	test("opens HTML and Markdown shares through the compressed #p document preview", async () => {
		const markdown = "# Local preview\n\n| A | B |\n|-|-|\n| 1 | 2 |";
		const payload = `data:text/markdown;base64,${Buffer.from(markdown).toString("base64")}`;
		await page.$eval(".base64-panel textarea", (textarea, value) => {
			textarea.value = value;
			textarea.dispatchEvent(new Event("input", { bubbles: true }));
		}, payload);
		await clickButtonContaining(".base64-panel", "Done");
		await page.$eval(".base64-details input", input => { input.value = "report.md"; input.dispatchEvent(new Event("input", { bubbles: true })); });
		await clickButtonContaining(".base64-details", "Share");
		await page.waitForSelector(".share-preview iframe");
		expect(await page.$eval(".share-preview iframe", iframe => iframe.hasAttribute("sandbox"))).toBe(true);
		await clickButtonContaining(".share-actions", "Open preview");
		await page.waitForFunction(() => location.hash.startsWith("#p:") && document.querySelector<HTMLDialogElement>(".share-preview-dialog")?.open === true);
		await page.reload();
		await page.waitForFunction(() => location.hash.startsWith("#p:") && document.querySelector<HTMLDialogElement>(".share-preview-dialog")?.open === true);
		await page.click(".share-preview-dialog header button");
		await page.waitForFunction(() => location.hash.startsWith("#share:"));
		await clickButtonContaining(".tool-header", "All tools");
		await page.waitForSelector(".home-shell");
		await page.waitForSelector(".upload-dropzone:not(.upload-dropzone--pending)");
	}, 30_000);

	test("keeps Edge PDF previews on the native unsandboxed iframe path", async () => {
		const url = shareUrl({
			name: "paper.pdf",
			mime: "application/pdf",
			bytes: new TextEncoder().encode("%PDF-1.4\n%%EOF\n")
		}, `http://localhost:${server.port}/make/index.html`);
		await page.goto(url);
		await page.waitForSelector(".share-preview iframe");
		const iframe = await page.$eval(".share-preview iframe", element => ({
			sandboxed: element.hasAttribute("sandbox"),
			source: (element as HTMLIFrameElement).src
		}));
		expect(iframe.sandboxed).toBe(false);
		expect(iframe.source).toStartWith("blob:");
		expect(await page.$('button[title="Open source in ln.kr in a new tab"]')).toBeNull();
		await clickButtonContaining(".tool-header", "All tools");
		await page.waitForSelector(".home-shell");
		await page.waitForSelector(".upload-dropzone:not(.upload-dropzone--pending)");
	}, 30_000);

	test("Edit hands text to ln.kr on click without leaving or mutating the share", async () => {
		const text = "hello\r\n  世界 👩🏽‍💻\n";
		for (const [name, mime, kind] of [
			["note.txt", "text/plain", "text"], ["app.js", "text/javascript", "javascript"],
			["page.html", "text/html", "html"], ["paper.md", "text/markdown", "markdown"]
		]) {
			const url = shareUrl({ name, mime, bytes: new TextEncoder().encode(text) }, `http://localhost:${server.port}/make/index.html`);
			await page.goto(url);
			await page.waitForSelector('button[title="Open source in ln.kr in a new tab"]');
			await page.evaluate(() => {
				const state = window as Window & { editCalls?: unknown[] };
				state.editCalls = [];
				window.open = (url, target, features) => { state.editCalls!.push([String(url), target, features]); return null; };
			});
			const scope = kind === "text" || kind === "javascript" ? ".share-code-toolbar" : ".share-preview";
			await page.click(`${scope} button[title="Open source in ln.kr in a new tab"]`);
			expect(await page.evaluate(() => (window as Window & { editCalls?: unknown[] }).editCalls)).toEqual([
				[lnkrEditUrl(text, kind as LnkrKind), "_blank", "noopener,noreferrer"]
			]);
			expect(page.url()).toBe(url);
			// The HTML parser normalizes CRLF for display; the handoff above must not.
			expect(await page.$eval(".share-source code", element => element.textContent)).toBe(text.replaceAll("\r\n", "\n"));
		}
		await page.setViewport({ width: 375, height: 812 });
		expect(await page.$$eval(".share-preview header button", buttons => buttons.every(button => button.getBoundingClientRect().right <= innerWidth))).toBe(true);
		await page.setViewport({ width: 800, height: 600 });
		await clickButtonContaining(".tool-header", "All tools");
		await page.waitForSelector(".upload-dropzone:not(.upload-dropzone--pending)");
	}, 30_000);

	test("offers MIME-correct Base64 copying from the original converter", async () => {
		await page.evaluate(() => {
			Object.defineProperty(navigator, "clipboard", {
				configurable: true,
				value: { writeText: async (value: string) => { (window as Window & { copiedFixture?: string }).copiedFixture = value; } }
			});
			const input = document.querySelector<HTMLInputElement>(".upload-dropzone input");
			if (!input) throw new Error("Missing converter input");
			const transfer = new DataTransfer();
			transfer.items.add(new File(["plain fixture"], "fixture.txt", { type: "text/plain" }));
			input.files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		});
		await page.waitForSelector(".conversion-body");
		await clickButtonContaining(".conversion-action-bar", "Copy Base64");
		await page.waitForFunction(() => (window as Window & { copiedFixture?: string }).copiedFixture?.startsWith("data:text/plain;base64,"));
		expect(await page.evaluate(() => (window as Window & { copiedFixture?: string }).copiedFixture)).toBe("data:text/plain;base64,cGxhaW4gZml4dHVyZQ==");
		await page.click(".conversion-header .logo");
		await page.waitForSelector(".home-shell");
	});

	test("combines a ZIP uploaded through Base64 and switches between pretty and raw", async () => {
		const zip = new JSZip();
		zip.file("src/index.js", "console.log('browser test');\n");
		zip.file("native/tool.dll", new Uint8Array([77, 90, 0, 1]));
		const bytes = [...await zip.generateAsync({ type: "uint8array" })];
		await page.evaluate(data => {
			const input = document.querySelector<HTMLInputElement>(".base64-file-picker");
			if (!input) throw new Error("Missing Base64 file input");
			const transfer = new DataTransfer();
			transfer.items.add(new File([new Uint8Array(data)], "fixture.zip", { type: "application/zip" }));
			input.files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, bytes);
		await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>(".base64-panel textarea")?.value.startsWith("data:application/zip;base64,"));
		await clickButtonContaining(".base64-panel", "Done");
		await clickButtonContaining(".base64-details", "Combine");
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

# [make it! - app.shel.sh/make](https://app.shel.sh/make/)
**Private browser-based conversion, OCR, base64, and archive tools.** 

## mk.it is my fork of convert.to.it, [see the upstream repo! - p2r3/convert](https://github.com/p2r3/convert)

It adds OCR, Base64, and Static-Page Document Sharing Tools.

It preserves the upstream conversion graph and handlers, then adds focused ways to decode, recognize, and combine files entirely in the browser.

Bun guidance:

```powershell
git clone https://github.com/CommanderTurtle/mk.it && cd mk.it
bun install && `
bun pm trust tesseract.js && `
bun pm trust @parcel/watcher && `
bun pm trust puppeteer esbuild canvas electron-winstaller && `
bun pm trust es5-ext; bun install; cd src/handlers/sppd && bun install && `
cd ../../../ && bun install && bun run build && `
echo "not convoluted at all, build ready"
```

Check out the upstream viral showcase of convert.to.it : https://youtu.be/btUbcsTbVA8

## All browser workflows in this fork :

This fork keeps the upstream conversion graph and its handlers intact, while expanding the home page to four entry points:

- **Convert a file** is the original Convert to it workflow. A single selected file can also be copied directly as a MIME-correct Base64 data URL without changing its bytes.
- **Base64 file** accepts raw base64 or a base64 data URL, or encodes any selected file without changing its bytes. The **Include MIME** switch chooses between a MIME-correct data URL and plain Base64. Decoded ZIP/TAR/7z uploads can continue directly into `combined.md`; other files can be named, downloaded, converted, or shared.
- **Shared files** use a versioned `#share:` fragment containing level-9 DEFLATE-compressed metadata and exact file bytes, followed by URL-safe Base64. The fragment is decoded locally and is never sent in the HTTP request. Textual files receive highlighted, copyable source; SVG images expose both source and image views; images, video, audio, and PDF files receive native previews with a full-window expander and copyable self-contained HTML. Images additionally expose ln.kr's self-contained pan-and-zoom viewer. HTML and Markdown expose a direct `#p:` preview URL using the same compact, lossless payload.
- **Image OCR** defaults to pinned Tesseract.js 7 with English recognition data. The adjacent **Paddle-OCR** button opts into the bundled multilingual PP-OCRv6 small models and ONNX WebAssembly runtime. Neither engine loads until selected. Paddle uses a temporary, single-threaded worker released after each scan (also on navigation, failure or its two-minute worker timeout); it needs neither WebGPU nor cross-origin isolation. Browser-readable images are scanned directly; other installed image formats are first normalized to PNG through the existing conversion graph. Both provide selectable image text and a plain-text view; Paddle overlays its real line boxes, without inventing word boxes.
- **Archive to Markdown** reads ZIP, TAR and 7z archives in memory, sorts paths, preserves text inside extension-aware code fences, and writes an explicit `(omitted)` entry for binary or oversized files. The result can be copied, browsed by file, or downloaded as `combined.md`. Archive share links show this same viewer alongside the original archive download and checksums. The viewer can reconstruct a ZIP of preserved text files; omitted binaries remain in the original archive. Stored and compressed 7z files use the bundled WebAssembly engine in a temporary browser thread, with no backend.

The new paths do not upload user data or extract archives onto the filesystem. OCR runtime files are served from the same build rather than a CDN. Archive processing is bounded to 20,000 entries, 512 MiB expanded data, 8 MiB per text file, and 64 MiB of combined source text to avoid accidental archive bombs or an unresponsive tab.

[Paddle](https://github.com/CommanderTurtle/ppocr-wasm) is already vendored under `public/ocr/paddle/` and copied unchanged by the normal Vite build. Deploy the complete directory, including models, worker chunks and both runtime files (`.mjs` and `.wasm`), below the configured base (`/make/` by default). This adds about 101 MB to the static build, not the initial page download. Paddle accepts images up to 32 MiB / 16 megapixels. Serve JavaScript modules and WASM with their correct MIME types; a restrictive CSP must allow same-origin module workers and the bundled OpenCV/ONNX runtime's evaluation requirements. The bundle's licenses, build metadata and SHA-256 manifest are retained alongside it.

To deliberately refresh that vendor snapshot from [our built](https://github.com/CommanderTurtle/ppocr-wasm) `ppocr-wasm` project (not needed for normal installs):

```sh
bun scripts/vendor-ppocr.mjs /path/to/ppocr-wasm/dist
bun run build
```

The maintenance importer pins the SDK/runtime versions and both model hashes. Updating those pins is an explicit maintenance change, never a runtime download from upstream.

**Edit** on shared Markdown, HTML, JavaScript and TXT files opens their decoded text in [ln.kr](https://a.shel.sh/) in a new tab; use its **Edit a copy** action to edit. The normal v4 document link is generated only on click using the existing DEFLATE dependency (JavaScript is not auto-run). Header links also connect to ln.kr and [Webclip](https://app.shel.sh/webclip). Media and PDF previews are unchanged.

## Usage

1. Go to [app.shel.sh/make](https://app.shel.sh/make/)
2. Click the big blue box to add your file (or just drag it on to the window).
3. An input format should have been automatically selected. If it wasn't, yikes! Try searching for it, or if it's really not there, see the "Issues" section below.
4. Select an output format from the second list. If you're on desktop, that's the one on the right side. If you're on mobile, it'll be somewhere lower down.
5. Click **Convert**!
6. Hopefully, after a bit (or a lot) of thinking, the program will spit out the file you wanted. If not, see the "Issues" section below.

<details><summary>Upstream Copypasta From Readme - Helpful for Agents</summary>

## Deployment

### Local development (Bun + Vite)

1. Clone this repository _**WITH SUBMODULES**_. You can use `git clone --recursive https://github.com/p2r3/convert` for that. Omitting submodules will leave you missing a few dependencies.
2. Install [Bun](https://bun.sh/).
3. Run `bun install` to install dependencies.
4. Run `bunx vite` to start the development server.

_The following steps are optional, but recommended for performance:_

When you first open the page, it'll take a while to generate the list of supported formats for each tool. If you open the console, you'll see it complaining a bunch about missing caches.

After this is done (indicated by a `Built initial format list` message in the console), use `printSupportedFormatCache()` to get a JSON string with the cache data. You can then save this string to `cache.json` to skip that loading screen on startup.

If you run into issues where your changes seem to not be applying, try disabling this cache.

### Docker (prebuilt image)

Docker compose files live in the `docker/` directory, so run compose with `-f` from the repository root:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Alternatively download the `docker-compose.yml` separately and start it by executing `docker compose up -d` in the same directory.

This runs the container on `http://localhost:8080/make/`.

### Docker (local build for development)

Use the override file to build the image locally:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up --build -d
```

The first Docker build is expected to be slow because Chromium and related system packages are installed in the build stage (needed for puppeteer in `buildCache.js`). Later builds are usually much faster due to Docker layer caching.

### Creating a handler

Each "tool" used for conversion has to be normalized to a standard form - effectively a "wrapper" that abstracts away the internal processes. These wrappers are available in [src/handlers](src/handlers/).

Below is a super barebones handler that does absolutely nothing. You can use this as a starting point for adding a new format:

```ts
// file: dummy.ts

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats, { Category } from "src/CommonFormats.ts";

class dummyHandler implements FormatHandler {
  public name: string = "dummy";
  public supportedFormats: FileFormat[] = [
    // Example PNG format, with both input and output disabled
    CommonFormats.PNG.builder("png").markLossless().allowFrom(false).allowTo(false),

    // Alternatively, if you need a custom format, define it like so:
    {
      name: "CompuServe Graphics Interchange Format (GIF)",
      format: "gif",
      extension: "gif",
      mime: "image/gif",
      from: false,
      to: false,
      internal: "gif",
      category: [Category.IMAGE, Category.VIDEO], // See src/CommonFormats.ts for valid categories
      lossless: false,
    },
  ];
  public ready: boolean = false;
  public offload: boolean = true;

  async init() {
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];
    return outputFiles;
  }
}

export default dummyHandler;
```

For more details on how all of these components work, refer to the doc comments in [src/FormatHandler.ts](src/FormatHandler.ts). You can also take a look at existing handlers to get a more practical example.

There are a few additional things that I want to point out in particular:

- Pay attention to the naming system. If your tool is called `dummy`, then the class should be called `dummyHandler`, and the file should be called `dummy.ts`.
- The handler is responsible for setting the output file's name. This is done to allow for flexibility in rare cases where the _full_ file name matters. Of course, in most cases, you'll only have to swap the file extension.
- The handler is also responsible for ensuring that any FileData or byte buffer objects that enter the handler _do not get mutated_. If necessary, clone the buffer by wrapping it in `new Uint8Array()`.
- When handling MIME types, run them through [normalizeMimeType](src/normalizeMimeType.ts) first. One file can have multiple valid MIME types, which isn't great when you're trying to match them algorithmically.
- Your handler may run in a web worker, so make sure that you do not use any incompatible Web APIs. `HTMLCanvasElement` -> `OffscreenCanvas` (`toBlob()` -> `convertToBlob()`), `new Image()` -> `createImageBitmap()`, avoid web audio and DOM APIs where possible. `offload` is last resort.
- When implementing/suggesting a new file format, please treat the file as the media that it represents, not the data that it contains. For example, if you were making an SVG handler, you should treat the file as an _image_, not as XML. In other words, avoid simple "binary waterfalls", as they're not semantically meaningful.

### Testing

This project currently uses two levels of tests:

- Broad project-level tests live directly in `test/` (for example graph traversal and end-to-end conversion smoke tests).
- Optional handler-specific unit tests live in `test/handlers/`, using the file name pattern `<handlerName>.test.ts`. These are a good fit for handlers with meaningful parsing, serialization, or file-naming logic that is hard to exercise reliably through traversal alone.

Not every handler needs a dedicated unit test, but handlers with non-trivial custom internal logic may benefit from having one.

The added workflows have focused unit and browser tests:

```bash
bun run test
bun test test/tooling.test.ts
bun test test/ui.test.ts
RUN_OCR_E2E=1 bun test test/ui.test.ts
```

`bun run test` names the repository-owned suites explicitly so Bun does not accidentally discover framework-specific tests inside vendored handler submodules. The opt-in OCR test generates a local fixture and verifies the real worker, core, and trained-data path without contacting a Tesseract CDN.

### Adding dependencies

Project modifications use [AGPL-3.0](./LICENSE); inherited convert code retains its [upstream terms](./src/UPSTREAM-LICENSE), and dependencies listed in [package.json](./package.json) and [.gitmodules](./.gitmodules) retain their notices.

If your tool requires an external dependency (which it likely does), there are currently two well-established ways of going about this:

- If it's an `npm` package, just install it to the project like you normally would.
- If it's a Git repository, add it as a submodule to [src/handlers](src/handlers).
- If neither of the above are available, then **as a last resort**, you may create a folder with the required assets under `src/handlers/handlerName`.

**Please try to avoid CDNs (Content Delivery Networks).** They're really cool on paper, but they don't work well with TypeScript, and each one introduces a tiny bit of instability. For a project that leans heavily on external dependencies, those bits of instability can add up fast.

- If you need to load a WebAssembly binary (or similar), add its path to [vite.config.js](vite.config.js) and target it under `/make/wasm/`. **Do not link to node_modules**.

</details>

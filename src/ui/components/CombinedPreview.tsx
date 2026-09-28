import { useEffect, useRef } from "preact/hooks";
import { parseCombinedMarkdown } from "src/tools/combined-markdown.js";
import { createCombinedBrowser } from "src/tools/combined-view.js";
import { buildMarkdownPreviewDocument } from "src/tools/documentPreview";

export default function CombinedPreview({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const bundle = parseCombinedMarkdown(source);
    if (!bundle) { host.textContent = source; return; }
    host.replaceChildren(createCombinedBrowser(bundle, source, (target: HTMLElement, entry: {path: string; language: string; text: string}) => {
      if (["md", "markdown"].includes(entry.language) || /\.(md|markdown)$/i.test(entry.path)) {
        const frame = document.createElement("iframe");
        frame.title = entry.path;
        frame.setAttribute("sandbox", "");
        frame.style.cssText = "width:100%;height:55vh;border:0";
        frame.srcdoc = buildMarkdownPreviewDocument(entry.text, entry.path).replace("<head>", '<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: blob:">');
        target.append(frame);
      } else {
        const pre = document.createElement("pre");
        pre.textContent = entry.text; target.append(pre);
      }
    }));
    return () => host.replaceChildren();
  }, [source]);
  return <div ref={ref} />;
}

import { base64DataUrl } from "./base64";
import { previewKind, type SharedFileData } from "./share";

export function imageViewerSource(source: string): string {
	return `(function (src) {
    var d = document,
    o = d.createElement('div');
    o.style = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:999999';
    var box = d.createElement('div');
    box.style = 'position:relative;width:100%;height:100%;overflow:hidden';
    var x = d.createElement('button');
    x.textContent = '✕';
    x.style = 'position:absolute;top:10px;right:10px;font-size:22px;padding:4px 10px;z-index:10';
    x.onclick = function () {
        o.remove();
    };
    var zi = d.createElement('button');
    zi.textContent = '+';
    zi.style = 'position:absolute;top:10px;left:10px;font-size:22px;padding:4px 10px;z-index:10';
    var zo = d.createElement('button');
    zo.textContent = '-';
    zo.style = 'position:absolute;top:10px;left:60px;font-size:22px;padding:4px 10px;z-index:10';
    var img = d.createElement('img');
    img.src = src;
    var img = d.createElement('img');
    img.src = src;
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.loading = 'eager';
    img.style = 'position:absolute;top:0;left:0;transform-origin:0 0;transform:translate(0px,0px) scale(1);cursor:grab';
    box.appendChild(img);
    box.appendChild(x);
    box.appendChild(zi);
    box.appendChild(zo);
    o.appendChild(box);
    d.body.appendChild(o);
    var scale = 1,
    tx = 0,
    ty = 0;
    function apply() {
        img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    }
    zi.onclick = function () {
        scale = Math.min(10, scale * 1.25);
        apply();
    };
    zo.onclick = function () {
        scale = Math.max(0.1, scale / 1.25);
        apply();
    };
    var drag = false,
    px = 0,
    py = 0;
    box.addEventListener('mousedown', e => {
        drag = true;
        img.style.cursor = 'grabbing';
        px = e.clientX;
        py = e.clientY;
    });
    box.addEventListener('mouseup', () => {
        drag = false;
        img.style.cursor = 'grab';
    });
    box.addEventListener('mouseleave', () => {
        drag = false;
        img.style.cursor = 'grab';
    });
    box.addEventListener('mousemove', e => {
        if (!drag)
            return;
        tx += e.clientX - px;
        ty += e.clientY - py;
        px = e.clientX;
        py = e.clientY;
        apply();
    });
    box.addEventListener('wheel', e => {
        e.preventDefault();
        var rect = box.getBoundingClientRect(),
        cx = e.clientX - rect.left,
        cy = e.clientY - rect.top,
        old = scale;
        scale = e.deltaY < 0 ? Math.min(10, scale * 1.1) : Math.max(0.1, scale / 1.1);
        tx = cx - (cx - tx) * (scale / old);
        ty = cy - (cy - ty) * (scale / old);
        apply();
    });
})(${JSON.stringify(source)});`;
}

export function imageViewerEval(file: SharedFileData): string | null {
	if (previewKind(file.mime) !== "image") return null;
	return imageViewerSource(base64DataUrl(file.bytes, file.mime));
}

export interface FileHashes {
	sha256: string;
	md5: string;
	sha1: string;
}

const MD5_SHIFTS = [
	7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
	5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
	4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
	6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

const MD5_CONSTANTS = Array.from(
	{ length: 64 },
	(_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x1_0000_0000) >>> 0
);

function bytesToHex(bytes: Uint8Array): string {
	let result = "";
	for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
	return result;
}

function rotateLeft(value: number, amount: number): number {
	return ((value << amount) | (value >>> (32 - amount))) >>> 0;
}

/** Computes MD5 locally without changing or re-encoding the source bytes. */
export function md5Hex(bytes: Uint8Array): string {
	const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
	const padded = new Uint8Array(paddedLength);
	padded.set(bytes);
	padded[bytes.length] = 0x80;

	const view = new DataView(padded.buffer);
	const bitLength = bytes.length * 8;
	view.setUint32(paddedLength - 8, bitLength >>> 0, true);
	view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x1_0000_0000), true);

	let a0 = 0x67452301;
	let b0 = 0xefcdab89;
	let c0 = 0x98badcfe;
	let d0 = 0x10325476;
	const words = new Uint32Array(16);

	for (let offset = 0; offset < paddedLength; offset += 64) {
		for (let index = 0; index < 16; index++) {
			words[index] = view.getUint32(offset + index * 4, true);
		}

		let a = a0;
		let b = b0;
		let c = c0;
		let d = d0;

		for (let index = 0; index < 64; index++) {
			let mixed: number;
			let wordIndex: number;
			if (index < 16) {
				mixed = (b & c) | (~b & d);
				wordIndex = index;
			} else if (index < 32) {
				mixed = (d & b) | (~d & c);
				wordIndex = (5 * index + 1) % 16;
			} else if (index < 48) {
				mixed = b ^ c ^ d;
				wordIndex = (3 * index + 5) % 16;
			} else {
				mixed = c ^ (b | ~d);
				wordIndex = (7 * index) % 16;
			}

			const previousD = d;
			d = c;
			c = b;
			const sum = (a + mixed + MD5_CONSTANTS[index] + words[wordIndex]) >>> 0;
			b = (b + rotateLeft(sum, MD5_SHIFTS[index])) >>> 0;
			a = previousD;
		}

		a0 = (a0 + a) >>> 0;
		b0 = (b0 + b) >>> 0;
		c0 = (c0 + c) >>> 0;
		d0 = (d0 + d) >>> 0;
	}

	const digest = new Uint8Array(16);
	const digestView = new DataView(digest.buffer);
	digestView.setUint32(0, a0, true);
	digestView.setUint32(4, b0, true);
	digestView.setUint32(8, c0, true);
	digestView.setUint32(12, d0, true);
	return bytesToHex(digest);
}

async function webCryptoHex(algorithm: "SHA-256" | "SHA-1", bytes: Uint8Array): Promise<string> {
	if (!globalThis.crypto?.subtle) throw new Error("This browser does not provide Web Crypto hashing.");
	const source = bytes.slice().buffer;
	return bytesToHex(new Uint8Array(await globalThis.crypto.subtle.digest(algorithm, source)));
}

export async function hashBytes(bytes: Uint8Array): Promise<FileHashes> {
	const [sha256, sha1] = await Promise.all([
		webCryptoHex("SHA-256", bytes),
		webCryptoHex("SHA-1", bytes)
	]);
	return { sha256, md5: md5Hex(bytes), sha1 };
}

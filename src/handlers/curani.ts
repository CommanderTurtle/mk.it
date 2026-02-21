// file: curani.ts

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";

class curaniHandler implements FormatHandler {

    public name: string = "curani";
    public supportedFormats?: FileFormat[];
    public ready: boolean = false;

    async init () {
        this.supportedFormats = [
            {
                name: "Microsoft Windows ANI",
                format: "ani",
                extension: "ani",
                mime: "application/x-navi-animation",
                from: true,
                to: true,
                internal: "ani",
                category: "image",
                lossless: false,
            },
            {
                name: "Microsoft Windows CUR",
                format: "cur",
                extension: "cur",
                mime: "image/vnd.microsoft.icon",
                from: true,
                to: true,
                internal: "cur",
                category: "image",
                lossless: false,
            },
            {
                name: "Microsoft Windows ICO",
                format: "ico",
                extension: "ico",
                mime: "image/vnd.microsoft.icon",
                from: true,
                to: true,
                internal: "ico",
                category: "image",
                lossless: false,
            }
        ];
        this.ready = true;
    }

    async doConvert (
        inputFiles: FileData[],
        inputFormat: FileFormat,
        outputFormat: FileFormat
    ): Promise<FileData[]> {
        return
        const outputFiles: FileData[] = [];

        for (const file of inputFiles) {
            try {
                let new_file_bytes = new Uint8Array(file.bytes);

                if (inputFormat.internal === "ani") {
                    // Extract the first frame of the .ani
                    if (outputFormat.internal === "cur") {
                        throw new Error("NEEDS TO BE IMPLEMENTED.");
                    }
                    else if (outputFormat.internal === "ico") {
                        throw new Error("Refuse to convert from .ani directly to .ico; must use .cur as an intermediary.");
                    }
                    else {
                        throw new Error("Invalid output format.");
                    }
                }
                else if (inputFormat.internal === "cur") {
                    // Turn a static cur into a single-frame .ani
                    if (outputFormat.internal === "ani") {
                        throw new Error("NEEDS TO BE IMPLEMENTED.");
                    }
                    // Convert a .cur into a .ico by removing hotspot and changing format header
                    else if (outputFormat.internal === "ico") {
                        // 1 for ICO, 2 for CUR
                        new_file_bytes[2] = 1;

                        const images_present = new_file_bytes[4];
                        let counter = 0;

                        // Editing fields of all ICONDIRECTORYs
                        while (counter < images_present) {
                            // color planes
                            new_file_bytes[10+(counter*16)] = 1;
                            new_file_bytes[11+(counter*16)] = 0;
                            // bits per pixel
                            new_file_bytes[12+(counter*16)] = 0;
                            new_file_bytes[13+(counter*16)] = 0;
                            counter += 1;
                        }
                    }
                    else {
                        throw new Error("Invalid output format.");
                    }
                }
                else if (inputFormat.internal === "ico") {
                    if (outputFormat.internal === "ani") {
                        throw new Error("Refuse to convert from .ico directly to .ani; must use .cur as an intermediary.");
                    }
                    // Convert a .cur into a .ico by ADDING hotspot and changing format header
                    else if (outputFormat.internal === "cur") {
                        // 1 for ICO, 2 for CUR
                        new_file_bytes[2] = 2;

                        const images_present = new_file_bytes[4];
                        let counter = 0;

                        // Editing fields of all ICONDIRECTORYs
                        while (counter < images_present) {
                            // color planes
                            new_file_bytes[10+(counter*16)] = 0;
                            new_file_bytes[11+(counter*16)] = 0;
                            // bits per pixel
                            new_file_bytes[12+(counter*16)] = 0;
                            new_file_bytes[13+(counter*16)] = 0;
                            counter += 1;
                        }
                        //throw new Error("NEEDS TO BE IMPLEMENTED.");
                    }
                    else {
                        throw new Error("Invalid output format.");
                    }
                }
                else {
                    throw new Error("Invalid input format.");
                }

                outputFiles.push({
                    name: "aaaaaaa",
                    bytes: new_file_bytes
                })
                //return outputFiles;
            }
            catch (e) {
                console.error(e);
            }
        }
    }
}

export default curaniHandler;


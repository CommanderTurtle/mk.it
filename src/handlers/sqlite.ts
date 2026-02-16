import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

class sqlite3Handler implements FormatHandler {

  public name: string = "sqlite3";
  public supportedFormats?: FileFormat[];
  public ready: boolean = false;

  async init () {
    this.supportedFormats = [
      {
        name: "SQLite3",
        format: "sqlite3",
        extension: "db",
        mime: "application/vnd.sqlite3",
        from: true,
        to: true,
        internal: "sqlite3"
      },
      {
        name: "Comma Seperated Values",
        format: "csv",
        extension: "csv",
        mime: "text/csv",
        from: true,
        to: true,
        internal: "csv"
      },
    ];
    this.ready = true;
  }

  getTables(db: any) {
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table';");
    let row: any[] = [];
    try {
      while (stmt.step()) {
        row.push(stmt.get(0));
      }
    } finally {
        stmt.finalize();
    }
    return row;
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];
    console.log(inputFiles);

    const sqlite3 = await sqlite3InitModule();

    for (const file of inputFiles) {
        const p = sqlite3.wasm.allocFromTypedArray(file.bytes);

        const db = new sqlite3.oo1.DB();
        const flags = sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE;
        const rc = sqlite3.capi.sqlite3_deserialize(
            db.pointer,
            "main",
            p,
            file.bytes.byteLength,
            file.bytes.byteLength,
            flags
        );
        db.checkRc(rc);

        
        for (const table of this.getTables(db)) {
            const csvData: any[][] = [];
            const stmt = db.prepare(`SELECT * FROM ${table}`);
            const headers = stmt.getColumnNames();
            try {
              while (stmt.step()) {
                let row: any[] = [];
                for (let j = 0; j < stmt.columnCount; j++) {
                    row.push(stmt.get(j));
                }
                csvData.push(row);
              }

              csvData[0] = headers; // Can do this as first row is dummy data for some reason
              console.log(csvData);
            } finally {
                stmt.finalize();
            }

             
            const lines: string[] = []
            for (const row of csvData) {
                lines.push(row.join(", "))
            }

            const encoder = new TextEncoder()
            outputFiles.push({
                name: table,
                bytes: new Uint8Array(encoder.encode(lines.join("\n")))
            })
        }
     }



    return outputFiles;
  }

}

export default sqlite3Handler;

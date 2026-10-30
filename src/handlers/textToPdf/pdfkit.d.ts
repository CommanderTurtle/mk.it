// Browser font registration is available from PDFKit 0.20 onward.
declare namespace PDFKit {
  interface PDFDocument {
    registerStdFonts(...fonts: object[]): void;
  }
}

declare module "pdfkit/standard-fonts/*" {
  const font: object;
  export default font;
}

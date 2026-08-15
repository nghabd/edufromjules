"use client";

import { pdfjs } from "react-pdf";

// Serve pdf.js worker from /public so it works offline and behind CSP.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

export { pdfjs };
const OCR_LANGS = "eng+chi_sim";
const TESSERACT_LANG_PATH = "https://tessdata.projectnaptha.com/4.0.0";

let workerPromise = null;
let pdfjsPromise = null;

function getTesseract() {
  if (!globalThis.Tesseract?.createWorker) {
    throw new Error("Tesseract OCR 引擎未加载");
  }
  return globalThis.Tesseract;
}

async function getWorker() {
  if (!workerPromise) {
    const { createWorker } = getTesseract();
    workerPromise = createWorker(OCR_LANGS, 1, {
      workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
      corePath: chrome.runtime.getURL("vendor/tesseract-core"),
      langPath: TESSERACT_LANG_PATH,
      workerBlobURL: false,
      logger: () => {}
    });
  }
  return await workerPromise;
}

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(chrome.runtime.getURL("vendor/pdfjs/pdf.min.mjs")).then((pdfjsLib) => {
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("vendor/pdfjs/pdf.worker.min.mjs");
      }
      return pdfjsLib;
    });
  }
  return await pdfjsPromise;
}

function fileExtension(file) {
  return file.name.split(".").pop()?.toLowerCase() || "";
}

async function extractDocxText(file) {
  if (!globalThis.mammoth?.extractRawText) {
    throw new Error("DOCX 解析引擎未加载");
  }
  const arrayBuffer = await file.arrayBuffer();
  const result = await globalThis.mammoth.extractRawText({ arrayBuffer });
  const text = result.value?.trim() || "";
  if (!text) {
    throw new Error("DOCX 未提取到文本");
  }
  return text;
}

async function recognizeCanvas(worker, canvas) {
  const {
    data: { text }
  } = await worker.recognize(canvas);
  return text?.trim() || "";
}

async function extractPdfText(file) {
  const pdfjsLib = await getPdfjs();
  const worker = await getWorker();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    disableWorker: true
  });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("无法创建 PDF 渲染上下文");
    }
    await page.render({ canvasContext: context, viewport }).promise;
    const text = await recognizeCanvas(worker, canvas);
    if (text) {
      pages.push(text);
    }
    page.cleanup();
  }

  const merged = pages.join("\n\n").trim();
  if (!merged) {
    throw new Error("PDF OCR 未识别到文本");
  }
  return merged;
}

export async function invokeDocumentOcr(file) {
  const extension = fileExtension(file);

  if (extension === "docx") {
    return await extractDocxText(file);
  }

  if (extension === "pdf") {
    return await extractPdfText(file);
  }

  if (extension === "doc") {
    throw new Error("DOC 本地解析暂不支持，请先转为 DOCX 或 PDF");
  }

  throw new Error("暂不支持的文件类型");
}

const OCR_LANGS = "eng+chi_sim";

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
      langPath: chrome.runtime.getURL("vendor/tessdata"),
      workerBlobURL: false,
      logger: () => {}
    }).then(async (worker) => {
      await worker.setParameters({
        preserve_interword_spaces: "1"
      });
      return worker;
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

async function recognizeCanvas(worker, canvas, options = undefined) {
  const {
    data: { text }
  } = await worker.recognize(canvas, options);
  return normalizeExtractedText(text || "");
}

async function recognizeCanvasByLines(worker, canvas) {
  const segments = splitCanvasIntoTextLines(canvas);
  if (segments.length === 0) {
    return await recognizeCanvas(worker, canvas);
  }

  const texts = [];
  for (const segment of segments) {
    const text = await recognizeCanvas(worker, segment, {
      tessedit_pageseg_mode: "7"
    });
    if (text) {
      texts.push(text);
    }
  }

  return normalizeExtractedText(texts.join("\n"));
}

function normalizeExtractedText(text) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPageTextFromItems(items) {
  if (!items?.length) return "";

  const rows = [];
  let currentRow = [];
  let lastY = null;

  for (const item of items) {
    if (!("str" in item) || !item.str) continue;
    const y = Math.round(item.transform?.[5] ?? 0);
    if (lastY === null || Math.abs(y - lastY) <= 4) {
      currentRow.push(item.str);
    } else {
      rows.push(currentRow.join(" ").trim());
      currentRow = [item.str];
    }
    lastY = y;
  }

  if (currentRow.length > 0) {
    rows.push(currentRow.join(" ").trim());
  }

  return normalizeExtractedText(rows.filter(Boolean).join("\n"));
}

function looksUsefulText(text) {
  const normalized = normalizeExtractedText(text);
  if (normalized.length < 40) return false;
  const cjkCount = (normalized.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = (normalized.match(/[A-Za-z]/g) || []).length;
  const digitCount = (normalized.match(/\d/g) || []).length;
  return cjkCount + latinCount + digitCount >= 30;
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function countCjk(text) {
  return countMatches(text, /[\u4e00-\u9fff]/g);
}

function scoreExtractedText(text) {
  const normalized = normalizeExtractedText(text);
  const cjkCount = countCjk(normalized);
  const latinCount = countMatches(normalized, /[A-Za-z]/g);
  const digitCount = countMatches(normalized, /\d/g);
  const symbolPenalty = countMatches(normalized, /[()[\]{}|=]/g);
  const bulletBonus = countMatches(normalized, /[•\-–—]/g);
  return cjkCount * 4 + latinCount + digitCount - symbolPenalty + bulletBonus;
}

function textLayerNeedsOcr(text) {
  const normalized = normalizeExtractedText(text);
  if (!normalized) return true;

  const cjkCount = countCjk(normalized);
  const latinCount = countMatches(normalized, /[A-Za-z]/g);
  const digitCount = countMatches(normalized, /\d/g);
  const meaningfulCount = cjkCount + latinCount + digitCount;

  if (normalized.length < 80) {
    return true;
  }

  // Suspicious case for Chinese resumes: lots of English/digits/bullets, but no Chinese at all.
  if (cjkCount === 0 && latinCount + digitCount >= 30) {
    return true;
  }

  if (meaningfulCount >= 30 && cjkCount / meaningfulCount < 0.03 && latinCount + digitCount >= 20) {
    return true;
  }

  // Text layer often drops CJK glyphs and leaves punctuation/empty parentheses behind.
  if (cjkCount <= 4 && /211\s*\(\s*\)/.test(normalized)) {
    return true;
  }

  return false;
}

function createProcessedCanvas(sourceCanvas) {
  const processedCanvas = document.createElement("canvas");
  processedCanvas.width = sourceCanvas.width;
  processedCanvas.height = sourceCanvas.height;
  const context = processedCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return sourceCanvas;
  }

  context.drawImage(sourceCanvas, 0, 0);
  const imageData = context.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const grayscale = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const normalized = grayscale > 188 ? 255 : grayscale < 110 ? 0 : grayscale;
    data[index] = normalized;
    data[index + 1] = normalized;
    data[index + 2] = normalized;
  }

  context.putImageData(imageData, 0, 0);
  return processedCanvas;
}

function splitCanvasIntoTextLines(sourceCanvas) {
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return [];
  }

  const { width, height } = sourceCanvas;
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const rowInkCounts = new Array(height).fill(0);

  for (let y = 0; y < height; y += 1) {
    let inkCount = 0;
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (data[index] < 210) {
        inkCount += 1;
      }
    }
    rowInkCounts[y] = inkCount;
  }

  const minInk = Math.max(12, Math.floor(width * 0.015));
  const bands = [];
  let bandStart = -1;

  for (let y = 0; y < height; y += 1) {
    if (rowInkCounts[y] >= minInk) {
      if (bandStart === -1) {
        bandStart = y;
      }
      continue;
    }

    if (bandStart !== -1) {
      bands.push([bandStart, y - 1]);
      bandStart = -1;
    }
  }

  if (bandStart !== -1) {
    bands.push([bandStart, height - 1]);
  }

  const mergedBands = [];
  for (const [top, bottom] of bands) {
    const previous = mergedBands[mergedBands.length - 1];
    if (previous && top - previous[1] <= 12) {
      previous[1] = bottom;
    } else {
      mergedBands.push([top, bottom]);
    }
  }

  return mergedBands
    .filter(([top, bottom]) => bottom - top >= 12)
    .map(([top, bottom]) => {
      const marginY = 8;
      const cropTop = Math.max(0, top - marginY);
      const cropBottom = Math.min(height, bottom + marginY);
      const segmentHeight = cropBottom - cropTop;
      const segmentCanvas = document.createElement("canvas");
      segmentCanvas.width = width;
      segmentCanvas.height = segmentHeight;
      const segmentContext = segmentCanvas.getContext("2d");
      if (!segmentContext) {
        return null;
      }
      segmentContext.fillStyle = "#ffffff";
      segmentContext.fillRect(0, 0, width, segmentHeight);
      segmentContext.drawImage(sourceCanvas, 0, cropTop, width, segmentHeight, 0, 0, width, segmentHeight);
      return segmentCanvas;
    })
    .filter(Boolean);
}

function shouldPreferOcrText(ocrText, textLayerText) {
  const normalizedOcr = normalizeExtractedText(ocrText);
  const normalizedTextLayer = normalizeExtractedText(textLayerText);
  const ocrCjkCount = countCjk(normalizedOcr);
  const textLayerCjkCount = countCjk(normalizedTextLayer);

  if (!normalizedTextLayer) {
    return Boolean(normalizedOcr);
  }

  if (!normalizedOcr) {
    return false;
  }

  if (ocrCjkCount >= Math.max(6, textLayerCjkCount * 2)) {
    return true;
  }

  if (textLayerCjkCount === 0 && ocrCjkCount > 0) {
    return true;
  }

  return scoreExtractedText(normalizedOcr) > scoreExtractedText(normalizedTextLayer);
}

async function extractPdfText(file) {
  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    disableWorker: true,
    cMapUrl: chrome.runtime.getURL("vendor/pdfjs/cmaps/"),
    cMapPacked: true,
    standardFontDataUrl: chrome.runtime.getURL("vendor/pdfjs/standard_fonts/")
  });
  const pdf = await loadingTask.promise;
  const pages = [];
  let worker = null;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const textLayerText = extractPageTextFromItems(textContent.items);
    let finalText = textLayerText;

    if (!looksUsefulText(textLayerText) || textLayerNeedsOcr(textLayerText)) {
      if (!worker) {
        worker = await getWorker();
      }

      const viewport = page.getViewport({ scale: 3 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        throw new Error("无法创建 PDF 渲染上下文");
      }
      await page.render({ canvasContext: context, viewport }).promise;
      const processedCanvas = createProcessedCanvas(canvas);
      const ocrText = await recognizeCanvasByLines(worker, processedCanvas);
      finalText = shouldPreferOcrText(ocrText, textLayerText) ? ocrText : textLayerText;
    }

    if (finalText) {
      pages.push(normalizeExtractedText(finalText));
    }
    page.cleanup();
  }

  const merged = normalizeExtractedText(pages.join("\n\n"));
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

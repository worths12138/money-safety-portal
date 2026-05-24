#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyMuPDF 提取 PDF 文本；对扫描页渲染 PNG 供后续 OCR。
stdin 传入 PDF 二进制，stdout 输出 JSON。
"""
from __future__ import annotations

import base64
import json
import sys

MAX_OCR_PAGES = 8
MIN_PAGE_TEXT = 15


def extract(data: bytes) -> dict:
    import fitz  # PyMuPDF

    doc = fitz.open(stream=data, filetype="pdf")
    page_texts: list[str] = []
    ocr_pages: list[dict] = []

    for i, page in enumerate(doc):
        text = (page.get_text("text") or "").strip()
        page_texts.append(text)
        if len(text) < MIN_PAGE_TEXT and len(ocr_pages) < MAX_OCR_PAGES:
            pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
            ocr_pages.append(
                {
                    "page": i + 1,
                    "b64": base64.standard_b64encode(pix.tobytes("png")).decode("ascii"),
                }
            )

    full = "\n\n".join(t for t in page_texts if t)
    return {"text": full, "pages": doc.page_count, "ocrPages": ocr_pages}


def main() -> None:
    data = sys.stdin.buffer.read()
    if not data:
        print(json.dumps({"error": "empty input"}, ensure_ascii=False))
        sys.exit(1)
    try:
        result = extract(data)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(2)


if __name__ == "__main__":
    main()

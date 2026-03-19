from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings


def normalize_input_to_image_bytes(input_bytes: bytes) -> bytes:
    if not input_bytes:
        raise ValueError("Input document is empty.")

    if _looks_like_pdf(input_bytes):
        return _render_pdf_first_page_to_png(input_bytes)

    return _normalize_raster_to_png(input_bytes)


def _looks_like_pdf(input_bytes: bytes) -> bool:
    return input_bytes[:5] == b"%PDF-"


def _normalize_raster_to_png(image_bytes: bytes) -> bytes:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            normalized = ImageOps.exif_transpose(image).convert("RGB")
            output = BytesIO()
            normalized.save(output, format="PNG", optimize=True)
            return output.getvalue()
    except UnidentifiedImageError as exc:
        raise ValueError("Unsupported or unreadable image format.") from exc


def _render_pdf_first_page_to_png(pdf_bytes: bytes) -> bytes:
    try:
        import pypdfium2 as pdfium
    except Exception as exc:
        raise RuntimeError("PDF support requires the pypdfium2 dependency.") from exc

    pdf = pdfium.PdfDocument(pdf_bytes)
    try:
        if len(pdf) < 1:
            raise ValueError("PDF has no pages.")

        page = pdf[0]
        try:
            page_width, page_height = page.get_size()
            longest_edge = max(float(page_width), float(page_height), 1.0)
            target_longest_edge = max(1400, int(settings.OCR_MAX_IMAGE_DIMENSION))

            # PDFium scale is DPI / 72. Keep quality high enough for OCR while bounded.
            scale = max(1.0, min(4.0, target_longest_edge / longest_edge))
            bitmap = page.render(scale=scale)
            image = bitmap.to_pil()
            normalized = ImageOps.exif_transpose(image).convert("RGB")

            output = BytesIO()
            normalized.save(output, format="PNG", optimize=True)
            return output.getvalue()
        finally:
            page.close()
    finally:
        pdf.close()

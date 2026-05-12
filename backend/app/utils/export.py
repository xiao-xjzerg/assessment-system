from urllib.parse import quote


def excel_content_disposition(filename: str) -> str:
    """Build a browser-compatible Content-Disposition header for Excel downloads."""
    safe_fallback = "".join(
        ch if ch.isascii() and ch not in {'"', "\\", ";"} else "_"
        for ch in filename
    )
    if not safe_fallback.endswith(".xlsx"):
        safe_fallback = "export.xlsx"
    encoded = quote(filename, safe="")
    return f"attachment; filename={safe_fallback}; filename*=UTF-8''{encoded}"

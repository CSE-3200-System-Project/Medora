#!/usr/bin/env python3
"""
Simple utility to remove emoji characters from source files in this repository.
- Scans files with text extensions
- Skips common generated or dependency folders (.next, node_modules, .venv)
- Removes emoji (and variation selectors) using Unicode ranges
- Prints a summary of changed files

Use only for text-only normalization (no code logic changes).
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDE_DIRS = {".git", "node_modules", ".next", "dist", "build", "venv", ".venv"}
FILE_EXTENSIONS = {'.md', '.mdx', '.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.txt', '.html', '.css'}

# Emoji & pictograph ranges (conservative but comprehensive)
EMOJI_RE = re.compile(
    "["+
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map
    "\U0001F1E0-\U0001F1FF"  # flags
    "\U00002700-\U000027BF"  # dingbats
    "\U000024C2-\U0001F251"  # enclosed chars
    "\U0001F900-\U0001F9FF"  # supplemental symbols
    "\U0001FA70-\U0001FAFF"  # symbols & pictographs extended-A
    "\u2600-\u26FF"          # misc symbols
    "\u2300-\u23FF"          # miscellaneous technical (e.g. hourglass)
    "]+",
    flags=re.UNICODE,
)

# Variation selector (common as part of emoji sequences)
VS_RE = re.compile("\uFE0F")

changed_files = []

for dirpath, dirnames, filenames in os.walk(ROOT):
    # skip excluded directories
    parts = set(Path(dirpath).parts)
    if parts & EXCLUDE_DIRS:
        # mutate dirnames to skip traversal into excluded dirs
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        continue

    for name in filenames:
        path = Path(dirpath) / name
        if path.suffix.lower() not in FILE_EXTENSIONS:
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except Exception:
            # binary or unreadable
            continue

        new_text = EMOJI_RE.sub('', text)
        # remove variation selectors left behind
        new_text = VS_RE.sub('', new_text)

        if new_text != text:
            path.write_text(new_text, encoding='utf-8')
            changed_files.append(str(path.relative_to(ROOT)))

# Print summary
if changed_files:
    print(f"Removed emoji from {len(changed_files)} files:")
    for f in changed_files:
        print(f" - {f}")
else:
    print("No emoji found in scanned files.")

# exit code 0

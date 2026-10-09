#!/usr/bin/env python3
"""Replace whole text runs in a .pptx and write a new file, leaving the source untouched.

    python pptx_replace.py in.pptx out.pptx edits.json

edits.json maps slide numbers (presentation order) to [old, new] pairs of run text:

    { "4": [["10", "14"], ["old sentence", "new sentence"]] }

Each `old` must match exactly one <a:t> run on that slide, or nothing is written.
Text is XML-escaped for you. Use "‑" (non-breaking hyphen) in names that must not
wrap mid-word. Standard library only; [Content_Types].xml is written first, and every
edited slide is checked for well-formed XML.
"""
import json
import re
import sys
import zipfile
from xml.dom import minidom
from xml.sax.saxutils import escape

from pptx_text import slide_order


def xml_text(text):
    # PowerPoint writes &amp; &lt; &gt; in runs and keeps quotes literal; &apos; also appears.
    return escape(text)


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    src, out, edits_file = sys.argv[1:]
    with open(edits_file, encoding="utf-8") as f:
        edits = json.load(f)
    with zipfile.ZipFile(src) as z:
        parts = {n: z.read(n) for n in z.namelist()}
        order = slide_order(z)
    for number, pairs in edits.items():
        part = order[int(number) - 1]
        xml = parts[part].decode("utf-8")
        for old, new in pairs:
            needle = "<a:t>" + xml_text(old) + "</a:t>"
            found = xml.count(needle)
            if found != 1:
                sys.exit(f"slide {number}: expected 1 run {old!r}, found {found} — nothing written")
            xml = xml.replace(needle, "<a:t>" + xml_text(new) + "</a:t>")
        minidom.parseString(xml.encode("utf-8"))
        parts[part] = xml.encode("utf-8")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", parts.pop("[Content_Types].xml"))
        for name, data in parts.items():
            z.writestr(name, data)
    print(f"wrote {out}: {sum(len(p) for p in edits.values())} run(s) on {len(edits)} slide(s)")


if __name__ == "__main__":
    main()

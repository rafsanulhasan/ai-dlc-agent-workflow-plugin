#!/usr/bin/env python3
"""Dump the text of a .pptx, one block per slide, in presentation order.

    python pptx_text.py deck.pptx            # paragraphs joined with " | "
    python pptx_text.py deck.pptx --runs     # every <a:t> run on its own numbered line

Standard library only. Use --runs before editing: replacements match whole runs.
"""
import re
import sys
import zipfile


def slide_order(z):
    pres = z.read("ppt/presentation.xml").decode("utf-8")
    rels = z.read("ppt/_rels/presentation.xml.rels").decode("utf-8")
    targets = {}
    for rel in re.findall(r"<Relationship\b[^>]*>", rels):
        rid = re.search(r'\bId="([^"]+)"', rel)
        target = re.search(r'\bTarget="([^"]+)"', rel)
        if rid and target:
            targets[rid.group(1)] = target.group(1)
    ids = re.findall(r'<p:sldId\b[^>]*\br:id="([^"]+)"', pres)
    # Targets are relative to ppt/ ("slides/slide1.xml") or absolute ("/ppt/slides/slide1.xml").
    return ["ppt/" + targets[i].lstrip("/").removeprefix("ppt/") for i in ids if i in targets]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    runs = "--runs" in sys.argv
    with zipfile.ZipFile(sys.argv[1]) as z:
        for n, part in enumerate(slide_order(z), 1):
            xml = z.read(part).decode("utf-8")
            print(f"=== slide {n} ({part})")
            if runs:
                for i, t in enumerate(re.findall(r"<a:t>([^<]*)</a:t>", xml), 1):
                    print(f"{i:4}  {t}")
            else:
                paras = re.findall(r"<a:p>.*?</a:p>|<a:p .*?</a:p>", xml, re.S)
                text = ["".join(re.findall(r"<a:t>([^<]*)</a:t>", p)) for p in paras]
                print(" | ".join(t for t in text if t.strip()))


if __name__ == "__main__":
    main()

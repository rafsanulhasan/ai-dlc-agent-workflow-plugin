// One case table for both copies of scrubSvg: hooks/diagram.ts (run by tests/diagram.test.ts under `plugin test`)
// and renderer/scrub.mjs (run by tests/lens-renderer/scrub.test.mjs under `node --test`). A plain module, because
// the hooks test runner loads code files only. Expected outputs are what a browser would read after the strip.
export const cases = [
  {
    "name": "single-quoted style with a remote url() loses the declaration",
    "input": "<svg><rect style='fill:url(http://x/a)'/></svg>",
    "output": "<svg><rect style=\"\"/></svg>"
  },
  {
    "name": "unquoted remote href is dropped",
    "input": "<svg><image href=http://x/a.png /></svg>",
    "output": "<svg><image/></svg>"
  },
  {
    "name": "slash-separated event handler is dropped",
    "input": "<svg/onload=alert(1)>",
    "output": "<svg>"
  },
  {
    "name": "single-quoted remote xlink:href is dropped",
    "input": "<svg><a xlink:href='http://x'>t</a></svg>",
    "output": "<svg><a>t</a></svg>"
  },
  {
    "name": "upper-case remote scheme is dropped",
    "input": "<svg><use href=\"HTTP://x\"/></svg>",
    "output": "<svg><use/></svg>"
  },
  {
    "name": "url() with spaces and a remote target is dropped",
    "input": "<svg><rect fill=\"url( http://x/a )\"/></svg>",
    "output": "<svg><rect/></svg>"
  },
  {
    "name": "local url(#g) stays in a presentation attribute and in style",
    "input": "<svg><rect fill='url(#g)' style=\"fill:url(#g)\"/></svg>",
    "output": "<svg><rect fill=\"url(#g)\" style=\"fill:url(#g)\"/></svg>"
  },
  {
    "name": "data: URI stays",
    "input": "<svg><image href=\"data:image/png;base64,AAAA\"/></svg>",
    "output": "<svg><image href=\"data:image/png;base64,AAAA\"/></svg>"
  },
  {
    "name": "numeric character reference hiding javascript: is dropped",
    "input": "<svg><a href=\"jav&#x61;script:alert(1)\">x</a></svg>",
    "output": "<svg><a>x</a></svg>"
  },
  {
    "name": "tab inside javascript: is dropped",
    "input": "<svg><a href=\"java\tscript:1\">x</a></svg>",
    "output": "<svg><a>x</a></svg>"
  },
  {
    "name": "style element: @import and remote url() go, local rules stay",
    "input": "<svg><style>@import url(http://x); .a{fill:url(http://y)} .b{fill:red}</style></svg>",
    "output": "<svg><style> .a{} .b{fill:red}</style></svg>"
  },
  {
    "name": "a > inside text content is left alone",
    "input": "<svg><text x=\"1\" y=\"2\">a > b</text><path d=\"M0 0 L1 1\"/></svg>",
    "output": "<svg><text x=\"1\" y=\"2\">a > b</text><path d=\"M0 0 L1 1\"/></svg>"
  },
  {
    "name": "a > inside a quoted attribute does not end the tag; the handler goes",
    "input": "<svg><rect title=\"a>b\" onclick=\"x\"/></svg>",
    "output": "<svg><rect title=\"a>b\"/></svg>"
  },
  {
    "name": "unquoted attribute values are re-quoted",
    "input": "<svg><rect width=10 height=5/></svg>",
    "output": "<svg><rect width=\"10\" height=\"5/\"/></svg>"
  },
  {
    "name": "script element goes with its content",
    "input": "<svg><script>alert(1)</script><g/></svg>",
    "output": "<svg><g/></svg>"
  },
  {
    "name": "comment text is scrubbed like markup",
    "input": "<svg><!-- <a href=http://x> --><g/></svg>",
    "output": "<svg><!-- <a> --><g/></svg>"
  },
  {
    "name": "CDATA text is scrubbed like markup",
    "input": "<svg><![CDATA[ <a href=http://x> ]]><g/></svg>",
    "output": "<svg><![CDATA[ <a> ]]><g/></svg>"
  },
  {
    "name": "xlink:href with an entity-hidden javascript: scheme is dropped",
    "input": "<svg><a xlink:href=\"javascript&#58;alert(1)\">x</a></svg>",
    "output": "<svg><a>x</a></svg>"
  },
  {
    "name": "an attribute glued to a quoted value keeps the quoted one and drops the handler",
    "input": "<svg><g a='x'onclick=y></g></svg>",
    "output": "<svg><g a=\"x\"></g></svg>"
  },
  {
    "name": "an unclosed tag drops the rest of the text",
    "input": "<svg><g/><rect x=\"1\"",
    "output": "<svg><g/>"
  },
  {
    "name": "a CSS escape in a declaration drops the declaration",
    "input": "<svg><style>.a{fill:\\75rl(http://x)} .b{fill:red}</style></svg>",
    "output": "<svg><style>.a{} .b{fill:red}</style></svg>"
  },
  {
    "name": "foreignObject goes with its content",
    "input": "<svg><foreignObject><div>x</div></foreignObject><g/></svg>",
    "output": "<svg><g/></svg>"
  },
  {
    "name": "a self-closing script goes",
    "input": "<svg><script src=\"http://x\"/><g/></svg>",
    "output": "<svg><g/></svg>"
  },
  {
    "name": "an href with a fragment stays",
    "input": "<svg><use href=\"#n\"/></svg>",
    "output": "<svg><use href=\"#n\"/></svg>"
  }
]

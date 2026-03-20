/**
 * Iframe template for AI-generated artefact blocks.
 *
 * Injects Olumi design tokens so the AI's HTML output looks native.
 * The embedded script reports body height to the parent via postMessage
 * for auto-sizing.
 */

const TEMPLATE_PREFIX = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;">
  <style>
    :root {
      --bg-canvas: #F4F0EA;
      --bg-panel: #FEFEFE;
      --bg-panel-hover: #FEF9F3;
      --border-default: #EEE6D8;
      --text-header: #262626;
      --text-body: #3F3F3E;
      --text-light: #908D8D;
      --primary: #63ADCF;
      --primary-hover: #67C89E;
      --danger: #EA7B4B;
      --success: #67C89E;
      --warning: #FFA656;
      --goal: #F5C433;
      --option: #AAA7E4;
      --factor: #B0A899;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      font-size: 14px;
      color: var(--text-body);
      background: transparent;
      padding: 16px;
      line-height: 1.5;
    }
    h1, h2, h3, h4 { color: var(--text-header); font-weight: 600; }
    h3 { font-size: 16px; margin-bottom: 12px; }
    h4 { font-size: 14px; margin-bottom: 8px; }

    button {
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 200ms ease-in-out;
    }
    button:hover { background: var(--primary-hover); }

    input, select {
      border: 1px solid var(--border-default);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 14px;
      color: var(--text-body);
      background: var(--bg-panel);
      outline: none;
      transition: border-color 200ms;
    }
    input:focus, select:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(99, 173, 207, 0.15);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: var(--bg-canvas);
      color: var(--text-header);
      font-weight: 600;
      font-size: 12px;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border-default);
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-default);
      font-size: 14px;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--bg-panel-hover); }
  </style>
</head>
<body>
`

const TEMPLATE_SUFFIX = `
  <script>
    function reportHeight() {
      window.parent.postMessage({
        type: 'olumi-artefact-resize',
        height: document.body.scrollHeight
      }, '*');
    }
    new ResizeObserver(reportHeight).observe(document.body);
    window.addEventListener('load', reportHeight);
  </script>
</body>
</html>`

/**
 * Strip external resource references from artefact HTML.
 * Defense-in-depth: the iframe sandbox (allow-scripts only, no allow-same-origin)
 * already isolates the content, but we strip external loads to prevent data
 * exfiltration and enforce the "no external script imports" constraint.
 */
export function sanitiseArtefactContent(html: string): string {
  return html
    // Remove <script src="..."> tags (keep inline <script>...</script>)
    .replace(/<script\b[^>]*\bsrc\s*=[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove <link> tags that load external stylesheets
    .replace(/<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*\/?>/gi, '')
    // Remove <iframe> tags (no nested iframes)
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '')
    // Remove <object> and <embed> tags
    .replace(/<object\b[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
}

/** Wrap raw artefact HTML in the Olumi-themed iframe template. */
export function buildArtefactSrcdoc(content: string): string {
  return TEMPLATE_PREFIX + sanitiseArtefactContent(content) + TEMPLATE_SUFFIX
}

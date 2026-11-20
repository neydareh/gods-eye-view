import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  linkSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const home = 'docs/pipeline-watch-plans';
const tracker = 'docs/PIPELINE_WATCH_WORKSTREAM_TRACKER.md';
const read = (file) => readFileSync(join(root, file), 'utf8');
const escape = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const inline = (s) => escape(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const idPattern = /^PW-W\d+-\d{3}$/;
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function dependencies(cell) {
  if (cell === 'None') return [];
  return cell.split(/,\s*/).flatMap((part) => {
    const match = /^W(\d+)-(\d{3})(?: through W(\d+)-(\d{3}))?$/.exec(part);
    requireValue(match, 'Invalid dependency: ' + part);
    const [, group, first, lastGroup, last = first] = match;
    requireValue(
      (!lastGroup || group === lastGroup) && Number(first) <= Number(last),
      'Invalid range: ' + part,
    );
    return Array.from(
      { length: Number(last) - Number(first) + 1 },
      (_, i) =>
        'PW-W' + group + '-' + String(Number(first) + i).padStart(3, '0'),
    );
  });
}

export function parseTracker(markdown) {
  const rows = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    if (!/^\s*\|\s*PW-/.test(line)) continue;
    const cells = line
      .trim()
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replaceAll('\\|', '|'));
    const [id, title, depends, file, acceptance, status] = cells;
    requireValue(
      line.trimEnd().endsWith('|') &&
        idPattern.test(id) &&
        cells.length === 6 &&
        cells.every(Boolean),
      'Malformed tracker row: ' + line,
    );
    requireValue(!rows.has(id), 'Duplicate tracker item: ' + id);
    const scope = file.replace(/^`|`$/g, '');
    const basis = createHash('sha256')
      .update(JSON.stringify([title, depends, scope, acceptance]))
      .digest('hex')
      .slice(0, 16);
    rows.set(id, {
      id,
      title,
      scope,
      acceptance,
      depends: dependencies(depends),
      status: status.replaceAll('`', ''),
      basis,
    });
  }
  requireValue(rows.size, 'Tracker contains no work items.');
  for (const row of rows.values()) {
    for (const dep of row.depends)
      requireValue(rows.has(dep), row.id + ' references missing ' + dep);
  }
  return rows;
}

const sections = ['description', 'steps', 'wireframe', 'flow', 'blast-radius'];
const statusField =
  /(<span\s+data-status(?:=["'][^"']*["'])?\s*>)[^<]*(<\/span>)/i;

function visibleText(fragment) {
  return fragment
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .trim();
}

// The plan template marks its five sections explicitly; nested application markup is allowed.
function inspectPage(row, html) {
  const markup = html.replace(
    /<!--[\s\S]*?-->|<style\b[^>]*>[\s\S]*?<\/style>/gi,
    '',
  );
  requireValue(
    /^\s*<!doctype html>/i.test(markup) && /<\/html>\s*$/i.test(markup),
    'Expected a complete HTML document.',
  );
  const main = markup.match(/<main\b([^>]*)>([\s\S]*?)<\/main>/i);
  requireValue(main, 'Missing main element.');
  const attribute = (name) =>
    main[1].match(
      new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(["\'])(.*?)\\1', 'i'),
    )?.[2];
  requireValue(attribute('data-work-item') === row.id, 'Wrong work-item ID.');
  requireValue(
    attribute('data-basis') === row.basis,
    'Tracker changed. Read its brief and update the plan.',
  );
  const stage = Number(attribute('data-stage'));
  requireValue(
    Number.isInteger(stage) && stage >= 1 && stage <= 6,
    'Expected a stage from 1 to 6.',
  );
  requireValue(statusField.test(main[2]), 'Missing tracker status field.');
  requireValue(
    !/\[\[[^\]]+\]\]/.test(main[2]),
    'Fill in the template placeholders.',
  );
  const markers = [
    ...main[2].matchAll(
      /<section\b[^>]*?\sdata-section\s*=\s*(["'])([^"']+)\1[^>]*>/gi,
    ),
  ];
  requireValue(
    markers.map((m) => m[2]).join(',') === sections.join(','),
    'Expected the five plan sections in template order.',
  );
  const body = markers.map((m, i) =>
    main[2].slice(m.index + m[0].length, markers[i + 1]?.index),
  );
  const description = body[0].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  requireValue(
    description && visibleText(description[1]),
    'Missing description.',
  );

  const steps = body[1].match(/<ol\b[^>]*>([\s\S]*?)<\/ol>/i)?.[1] ?? '';
  const entries = [...steps.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
  requireValue(
    entries.length >= 3 &&
      entries.every((m) => visibleText(m[1])) &&
      /<code\b[^>]*>\s*[^<\s][^<]*<\/code>/i.test(steps),
    'Expected nonempty ordered execution steps and a verification command.',
  );

  const figure =
    body[2].match(/<figure\b[^>]*>([\s\S]*?)<\/figure>/i)?.[1] ?? '';
  const caption = figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
  const preview = figure.replace(
    /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>|<aside\b[^>]*>[\s\S]*?<\/aside>/gi,
    '',
  );
  const sourceRefs = [
    ...(caption?.[1] ?? '').matchAll(/<code\b[^>]*>([^<]+)<\/code>/gi),
  ];
  const hasSource = sourceRefs.some((m) => {
    const path = m[1].trim();
    return (
      !path.split('/').includes('..') &&
      /^(?:index\.html|(?:src|public)\/[\w./-]+\.(?:html|js|jsx|ts|tsx|vue|svelte))$/.test(
        path,
      ) &&
      existsSync(join(root, path))
    );
  });
  requireValue(
    hasSource &&
      (visibleText(preview) || /<(?:img|svg|canvas)\b/i.test(preview)) &&
      /<[a-z][^>]*>/i.test(preview),
    'Expected an application preview and a source file in its caption.',
  );

  const svg = body[3].match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/i)?.[1] ?? '';
  const drawing = svg.replace(/<defs\b[^>]*>[\s\S]*?<\/defs>/gi, '');
  requireValue(
    /<(?:path|line|polyline|polygon)\b/i.test(drawing) &&
      /<text\b[^>]*>[\s\S]*?<\/text>/i.test(drawing) &&
      visibleText(drawing),
    'Expected a labeled flow diagram with visible connections.',
  );

  const paths = [];
  for (const m of body[4].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if (!cells.length) continue;
    const badge = cells[0][1]
      .trim()
      .match(/^<code\b[^>]*>\s*([^<]+?)\s*<\/code>$/i);
    requireValue(
      badge && cells[1] && visibleText(cells[1][1]),
      'Each affected file needs a path badge and a proposed impact.',
    );
    paths.push(badge[1]);
  }
  requireValue(
    paths.some(
      (p) =>
        p === row.scope || (row.scope.endsWith('/') && p.startsWith(row.scope)),
    ),
    'Missing primary file badge.',
  );
  requireValue(
    new Set(paths).size === paths.length,
    'Duplicate file in blast radius.',
  );
  return stage;
}

function extract(source, pattern, label) {
  const match = source.match(pattern);
  requireValue(match, 'Application preview source changed: ' + label);
  return match[0];
}
function appParts() {
  const app = read('index.html');
  const map = read('src/ui/templates/layer-panels.html');
  const controls = read('src/ui/styles/controls.css');
  return {
    camera: extract(
      app,
      /<header class="cctv-watch-header">[\s\S]*?<\/header>/,
      'CCTV Watch header',
    ),
    summary: extract(
      app,
      /<div class="cctv-watch-summary">[\s\S]*?<\/div>/,
      'review summary',
    ),
    map: extract(
      map.slice(map.indexOf('id="data-panel"')),
      /<div class="panel-header">[\s\S]*?<\/div>/,
      'Data Layers header',
    ),
    tokens: extract(
      read('src/ui/styles/foundation.css'),
      /:root\s*\{[^}]+\}/,
      'foundation tokens',
    ),
    cameraCss: read('src/ui/styles/cctv-watch.css'),
    mapCss: [
      'panel-header',
      'panel-title',
      'panel-divider',
      'panel-collapse-btn',
    ]
      .map((s) => extract(controls, new RegExp('\\.' + s + ' \\{[^}]+\\}'), s))
      .join('\n'),
  };
}

function wireframe(preview, parts) {
  const camera = preview.surface === 'camera';
  const isFeature = preview.mode === 'feature';
  const area = camera ? 'CCTV Watch' : 'Data Layers';
  const sample =
    '<p class="proposed"><strong>' +
    escape(preview.label) +
    '</strong><br>' +
    escape(preview.detail) +
    '</p>';
  const header = (camera ? parts.camera : parts.map).replace(
    '<button ',
    '<button disabled ',
  );
  const inside =
    '<div class="' +
    (camera ? 'cctv-watch-module' : 'map-panel') +
    '">' +
    header +
    (camera
      ? '<div class="cctv-watch-detail">' +
        (isFeature ? sample : '') +
        '<div class="cctv-watch-analysis">' +
        (preview.reviewState
          ? parts.summary.replace('Select a camera to begin.', () =>
              escape(preview.reviewState),
            )
          : parts.summary) +
        '</div></div>'
      : isFeature
        ? sample
        : '') +
    '</div>';
  return (
    '<figure>' +
    inside +
    '<figcaption>' +
    (isFeature
      ? 'Proposed feature in the '
      : 'Existing downstream surface in the ') +
    area +
    ' panel. App markup from <code>' +
    (camera ? 'index.html' : 'src/ui/templates/layer-panels.html') +
    '</code>.</figcaption>' +
    (isFeature
      ? ''
      : '<aside><strong>Example downstream result</strong>' +
        sample +
        '</aside>') +
    '</figure>'
  );
}

function diagram(flow) {
  const coords = [
    [210, 24],
    [210, 99],
    [102, 205],
    [318, 205],
  ];
  const boxes = coords.map(([x, y], i) => {
    const words = flow[i].split(' ');
    let lines = [''];
    for (const word of words) {
      if ((lines.at(-1) + ' ' + word).trim().length > 21 && lines.at(-1))
        lines.push('');
      lines[lines.length - 1] = (lines.at(-1) + ' ' + word).trim();
    }
    return (
      '<g><title>' +
      escape(flow[i]) +
      '</title><rect x="' +
      (x - 99) +
      '" y="' +
      (y - 24) +
      '" width="198" height="48" rx="9"/><text x="' +
      x +
      '" y="' +
      (y + 5 - 8 * (lines.length - 1)) +
      '">' +
      lines
        .map(
          (l, j) =>
            '<tspan x="' +
            x +
            '" dy="' +
            (j ? 15 : 0) +
            '">' +
            escape(l) +
            '</tspan>',
        )
        .join('') +
      '</text></g>'
    );
  });
  return (
    '<svg viewBox="0 0 420 232" role="img" aria-label="' +
    escape(
      flow[0] + '. ' + flow[1] + ' Yes: ' + flow[2] + '. No: ' + flow[3] + '.',
    ) +
    '"><defs><marker id="tip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path fill="#00d4ff" d="M0 0L10 5L0 10Z"/></marker></defs><g class="edges" marker-end="url(#tip)"><path d="M210 48V74"/><path d="M210 123V146H102V180"/><path d="M210 123V146H318V180"/></g><text x="83" y="165">Yes</text><text x="337" y="165">No</text>' +
    boxes.join('') +
    '</svg>'
  );
}
const stages = [
  'Practice run',
  'Core analytics and supervised monitoring',
  'Operator workflow',
  'Integration and hardware-in-the-loop',
  'Pilot hardening',
  'Future persistent monitoring',
];
const link = (id) => '<a href="' + id + '.html">' + id + '</a>';
const section = (id, title, body) =>
  '<section data-section="' +
  id +
  '"><h2>' +
  title +
  '</h2>' +
  body +
  '</section>';
function document(title, css, body) {
  return (
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escape(title) +
    '</title><style>' +
    css +
    '</style></head><body><main>' +
    body +
    '</main></body></html>\n'
  );
}
function itemPage(row, p, parts, css) {
  const title = row.title.replace(/\.$/, '');
  return document(
    title,
    css + (p.preview.surface === 'camera' ? parts.cameraCss : parts.mapCss),
    '<header><a href="index.html#stage-' +
      p.stage +
      '">All plans</a><p class="meta">' +
      row.id +
      ' · Stage ' +
      p.stage +
      ' · ' +
      '<span data-status>' +
      escape(row.status) +
      '</span>' +
      '</p><h1>' +
      escape(title) +
      '</h1></header>' +
      section(
        'description',
        'Work-item description',
        '<p>' +
          inline(p.description) +
          '</p><p><strong>Acceptance</strong> ' +
          inline(row.acceptance) +
          '</p><p><strong>Depends on</strong> ' +
          (row.depends.map(link).join(', ') || 'None') +
          '</p>',
      ) +
      section(
        'steps',
        'Proposed execution steps',
        '<ol>' +
          p.steps.map((s) => '<li>' + inline(s) + '</li>').join('') +
          '<li>Verify the proposed implementation with <code>' +
          escape(p.verify) +
          '</code>.</li></ol>',
      ) +
      section(
        'wireframe',
        'Application wireframe',
        wireframe(p.preview, parts),
      ) +
      section('flow', 'Feature flowchart', diagram(p.flow)) +
      section(
        'blast-radius',
        'Blast radius',
        '<table><thead><tr><th scope="col">Repository path</th><th scope="col">Proposed impact</th></tr></thead><tbody>' +
          p.files
            .map(
              ([f, why]) =>
                '<tr><td><code>' +
                escape(f) +
                '</code></td><td>' +
                inline(why) +
                '</td></tr>',
            )
            .join('') +
          '</tbody></table>',
      ),
  ).replace(
    '<body><main>',
    '<body><main data-work-item="' +
      row.id +
      '" data-stage="' +
      p.stage +
      '" data-basis="' +
      row.basis +
      '">',
  );
}

function template(row, surface = 'camera') {
  requireValue(['camera', 'map'].includes(surface), 'Choose camera or map.');
  const parts = appParts();
  return itemPage(
    row,
    {
      stage: '[[stage]]',
      description: '[[What this item delivers and why]]',
      steps: [
        '[[Implement the change]]',
        '[[Handle edge cases]]',
        '[[Test the expected result]]',
      ],
      verify: '[[verification command]]',
      preview: {
        surface,
        mode: 'feature',
        label: '[[Proposed label]]',
        detail: '[[Proposed feature state]]',
      },
      flow: ['[[Input]]', '[[Decision?]]', '[[Yes outcome]]', '[[No outcome]]'],
      files: [[row.scope, '[[Expected change to this file]]']],
    },
    parts,
    parts.tokens + read(home + '/plan.css'),
  );
}

function outputPages(rows, only) {
  const problems = [];
  const pages = new Map();
  const groups = stages.map(() => []);
  for (const [id, row] of rows) {
    if (only && id !== only) continue;
    try {
      const path = home + '/html/' + id + '.html';
      requireValue(
        existsSync(join(root, path)),
        'Missing HTML plan. Run new ' + id + '.',
      );
      const html = read(path);
      const stage = inspectPage(row, html);
      pages.set(
        id + '.html',
        html.replace(
          statusField,
          (_, open, close) => open + escape(row.status) + close,
        ),
      );
      groups[stage - 1].push(
        '<li>' +
          link(id) +
          ' <span>' +
          escape(row.title) +
          '</span> <small>' +
          escape(row.status) +
          '</small></li>',
      );
    } catch (e) {
      problems.push(id + ': ' + e.message);
    }
  }
  requireValue(!problems.length, problems.join('\n'));
  if (only) return pages;
  const groupsHtml = groups
    .map(
      (items, i) =>
        '<section id="stage-' +
        (i + 1) +
        '"><h2>Stage ' +
        (i + 1) +
        ' · ' +
        stages[i] +
        '</h2><ul>' +
        items.join('') +
        '</ul></section>',
    )
    .join('');
  pages.set(
    'index.html',
    document(
      'Pipeline Watch work-item plans',
      extract(
        read('src/ui/styles/foundation.css'),
        /:root\s*\{[^}]+\}/,
        'foundation tokens',
      ) + read(home + '/plan.css'),
      '<header><p class="meta">Pipeline Watch</p><h1>Work-item plans</h1><p>' +
        rows.size +
        ' plans grouped by proposed delivery stage. Dependency links on each page show which items come first.</p><nav>' +
        stages
          .map(
            (_, i) =>
              '<a href="#stage-' + (i + 1) + '">Stage ' + (i + 1) + '</a>',
          )
          .join(' ') +
        '</nav></header>' +
        groupsHtml,
    ),
  );
  return pages;
}

export function syncPages(dir, pages, build, only = false) {
  if (build) mkdirSync(dir, { recursive: true });
  const existing = existsSync(dir) ? readdirSync(dir) : [];
  const errors = only
    ? []
    : existing
        .filter((f) => f.endsWith('.html') && !pages.has(f))
        .map((f) => 'Extra page: ' + f);
  requireValue(!errors.length, errors.join('\n'));
  for (const [name, html] of pages) {
    const path = join(dir, name);
    if (existsSync(path) && readFileSync(path, 'utf8') === html) continue;
    if (!build) {
      errors.push((existsSync(path) ? 'Stale' : 'Missing') + ' page: ' + name);
      continue;
    }
    const tmp = path + '.' + randomUUID() + '.tmp';
    try {
      writeFileSync(tmp, html);
      renameSync(tmp, path);
    } finally {
      rmSync(tmp, { force: true });
    }
  }
  requireValue(!errors.length, errors.join('\n'));
}

function brief(row, rows) {
  return {
    ...row,
    prerequisites: row.depends.map((d) => rows.get(d).scope),
    read: [
      tracker,
      'docs/PRD_PIPELINE_WATCH.md',
      'docs/MASTER_PLAN_PIPELINE_WATCH_SOFTWARE.md',
    ],
    example: home + '/html/PW-W5-012.html',
    edit: home + '/html/' + row.id + '.html',
  };
}

// Publish only a complete, validated plan. Concurrent runs never replace an authored source.
function author(row, rows) {
  const info = brief(row, rows);
  const dest = join(root, info.edit);
  if (existsSync(dest)) {
    inspectPage(row, readFileSync(dest, 'utf8'));
    return;
  }
  const work = mkdtempSync(join(tmpdir(), 'pipeline-plan-'));
  const output = join(work, 'answer.html');
  mkdirSync(join(root, home, 'html'), { recursive: true });
  const pending = dest + '.' + randomUUID() + '.tmp';
  try {
    const prompt = [
      'Draft one Pipeline Watch implementation plan. This is the read-only drafting step of the planning harness.',
      'Read the tracker brief, its requirements and the relevant application source. Use the example HTML for the five-section layout.',
      'Return only a complete static HTML document, beginning with <!doctype html>. Use the supplied template. Fill every double-bracket placeholder, including the stage (1–6). Preserve work-item ID, basis, status markup and section order.',
      'Write specific implementation steps, edge cases and a verification command. Use actual application markup and styles for the wireframe, indicate the source, and show an internal feature as a downstream example when appropriate. Adapt the inline SVG to this feature. Include affected file badges and reasons.',
      'Use the map template if more appropriate: node scripts/pipeline-watch-plans.mjs template ' +
        row.id +
        ' map. You may read files; do not implement the feature or run the new command.',
      template(row),
      JSON.stringify(info),
    ].join('\n');
    const result = spawnSync(
      'codex',
      [
        'exec',
        '--sandbox',
        'read-only',
        '--ephemeral',
        '--output-last-message',
        output,
        '-',
      ],
      {
        cwd: root,
        input: prompt,
        stdio: ['pipe', 'inherit', 'inherit'],
        encoding: 'utf8',
      },
    );
    if (result.error) throw result.error;
    requireValue(
      result.status === 0,
      'Codex drafting failed. In your open Codex chat ask: Plan ' +
        row.id +
        ' using the planning harness.',
    );
    const html = readFileSync(output, 'utf8');
    inspectPage(row, html);
    const current = parseTracker(read(tracker)).get(row.id);
    requireValue(
      current?.basis === row.basis,
      'Tracker changed during drafting. Retry ' + row.id + '.',
    );
    writeFileSync(pending, html, {
      flag: 'wx',
    });
    try {
      linkSync(pending, dest);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      inspectPage(row, readFileSync(dest, 'utf8'));
    }
  } finally {
    rmSync(pending, { force: true });
    rmSync(work, { recursive: true, force: true });
  }
}

function main([cmd, id, ...rest]) {
  const rows = parseTracker(read(tracker));
  requireValue(
    ['build', 'check', 'new', 'brief', 'template'].includes(cmd) &&
      (cmd === 'template' ? rest.length <= 1 : !rest.length),
    'Usage: npm run plans -- new ID | brief ID | template ID [camera|map] | build [ID] | check [ID]',
  );
  const row = rows.get(id);
  if (id || ['new', 'brief', 'template'].includes(cmd))
    requireValue(row, 'Unknown work item: ' + (id || '(missing ID)'));
  if (cmd === 'template') {
    process.stdout.write(template(row, rest[0]));
    return;
  }
  if (cmd === 'brief') {
    console.log(JSON.stringify(brief(row, rows), null, 2));
    return;
  }
  if (cmd === 'new') author(row, rows);
  const dir = join(root, home, 'html');
  const pages = outputPages(rows, id);
  syncPages(dir, pages, cmd !== 'check', Boolean(id));
  if (cmd === 'new') {
    // Refresh the index when full coverage is available. The requested page is already usable.
    try {
      syncPages(dir, outputPages(rows), true);
    } catch (err) {
      console.warn('Individual plan ready. Full index pending: ' + err.message);
    }
  }
  console.log(
    (cmd === 'check' ? 'Verified ' : 'Rendered ') +
      (id
        ? home + '/html/' + id + '.html'
        : rows.size + ' work-item pages and ' + home + '/html/index.html'),
  );
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  readdirSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTracker } from './pipeline-watch-plans.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const id = 'PW-W8-001';
const row =
  '| PW-W8-001 | Show last review time. | None | `src/pipelineWatch/reviewTime.js` | Show a timestamp on a reviewed incident. | PLANNED |';

test('enforces tracker identity and expands dependency ranges', () => {
  const base = (n) => row.replace(id, 'PW-W8-00' + n);
  const rows = parseTracker(
    [base(1), base(2), base(3).replace('None', 'W8-001 through W8-002')].join(
      '\n',
    ),
  );
  assert.deepEqual(rows.get('PW-W8-003').depends, [id, 'PW-W8-002']);
  assert.throws(() => parseTracker(row + '\n' + row), /Duplicate/);
  assert.throws(
    () => parseTracker(row.replace('None', 'W9-003')),
    /missing PW-W9-003/,
  );
});

// Simulate just the Codex CLI response. The actual CLI entry point, tracker,
// source validation, app-fragment extraction and filesystem writes run normally.
test(
  'direct HTML authoring, stable edits and tracker checks',
  { skip: process.platform === 'win32' },
  (t) => {
    const temp = mkdtempSync(join(tmpdir(), 'pipeline-plan-test-'));
    t.after(() => rmSync(temp, { recursive: true, force: true }));
    const home = 'docs/pipeline-watch-plans';
    for (const name of [
      'scripts/pipeline-watch-plans.mjs',
      home + '/plan.css',
      'index.html',
      'src/ui/templates/layer-panels.html',
      ...['controls', 'cctv-watch', 'foundation'].map(
        (n) => 'src/ui/styles/' + n + '.css',
      ),
    ]) {
      mkdirSync(dirname(join(temp, name)), { recursive: true });
      cpSync(join(root, name), join(temp, name));
    }
    const tracker = join(temp, 'docs/PIPELINE_WATCH_WORKSTREAM_TRACKER.md');
    writeFileSync(tracker, row);
    const env = { ...process.env, PATH: temp + delimiter + process.env.PATH };
    const run = (...args) =>
      spawnSync(
        process.execPath,
        ['scripts/pipeline-watch-plans.mjs', ...args],
        { cwd: temp, env, encoding: 'utf8' },
      );
    const ok = (...args) => {
      const result = run(...args);
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    const brief = JSON.parse(ok('brief', id));
    assert.equal(brief.edit, home + '/html/' + id + '.html');
    const draft = ok('template', id);
    const fields = {
      stage: '3',
      'What this item delivers and why': 'Show the latest review time.',
      'Implement the change': 'Read the latest named review.',
      'Handle edge cases': 'Show an empty state for missing review times.',
      'Test the expected result':
        'Compare the visible timestamp to a known fixture.',
      'verification command':
        'node --test src/pipelineWatch/reviewTime.test.mjs',
      'Proposed label': 'Last reviewed',
      'Proposed feature state': '14:30 UTC',
      Input: 'Select incident',
      'Decision?': 'Review present?',
      'Yes outcome': 'Show review time',
      'No outcome': 'Show awaiting review',
      'Expected change to this file': 'Format the review timestamp.',
    };
    const complete = draft.replace(
      /\[\[([^\]]+)\]\]/g,
      (match, key) => fields[key] ?? match,
    );
    const page = join(temp, home, 'html', id + '.html');
    const provider = join(temp, 'codex');
    writeFileSync(
      provider,
      '#!/bin/sh\ncat >/dev/null\nwhile [ "$1" != "--output-last-message" ]; do shift; done\ncp answer.html "$2"\n',
      { mode: 0o700 },
    );
    writeFileSync(join(temp, 'answer.html'), draft);
    assert.equal(run('new', id).status, 1);
    assert.equal(existsSync(page), false);
    writeFileSync(
      join(temp, 'answer.html'),
      complete.replace('data-section="steps"', 'data-section="wrong"'),
    );
    assert.match(run('new', id).stderr, /five plan sections/);
    assert.equal(existsSync(page), false);
    const incompleteSections = [
      [
        'wireframe',
        '<figure><figcaption>Preview</figcaption></figure>',
        /application preview/i,
      ],
      ['flow', '<svg></svg>', /flow diagram/i],
      [
        'steps',
        '<ol><li></li><li></li><li><code>npm test</code></li></ol>',
        /execution steps/i,
      ],
      [
        'blast-radius',
        '<table><tr><td><code>' +
          brief.scope +
          '</code></td><td></td></tr></table>',
        /impact/i,
      ],
    ];
    for (const [section, replacement, message] of incompleteSections) {
      const contents = new RegExp(
        '(<section data-section="' + section + '">)[\\s\\S]*?(</section>)',
      );
      writeFileSync(
        join(temp, 'answer.html'),
        complete.replace(contents, '$1' + replacement + '$2'),
      );
      const result = run('new', id);
      assert.equal(result.status, 1, 'Accepted incomplete ' + section);
      assert.match(result.stderr, message);
      assert.equal(existsSync(page), false);
    }
    writeFileSync(join(temp, 'answer.html'), complete);
    ok('new', id);
    const html = readFileSync(page, 'utf8');
    assert.deepEqual(
      [...html.matchAll(/<section data-section="([^"]+)"/g)].map((m) => m[1]),
      ['description', 'steps', 'wireframe', 'flow', 'blast-radius'],
    );
    assert.match(html, /class="cctv-watch-header"/);
    assert.match(html, /<td><code>src\/pipelineWatch\/reviewTime.js<\/code>/);
    assert.match(html, /background: var\(--accent-dim\)/);
    assert.match(html, /<svg viewBox=/);
    assert.match(
      readFileSync(join(temp, home, 'html/index.html'), 'utf8'),
      /PW-W8-001.html/,
    );
    ok('check');
    const edited = html.replace(
      'Show the latest review time.',
      'Preserve my edited rationale.',
    );
    writeFileSync(page, edited);
    ok('new', id);
    ok('build');
    ok('check', id);
    assert.equal(readFileSync(page, 'utf8'), edited);
    assert.deepEqual(readdirSync(dirname(page)).sort(), [
      id + '.html',
      'index.html',
    ]);
    assert.equal(existsSync(join(temp, home, 'items')), false);
    writeFileSync(tracker, row.replace('PLANNED', 'READY'));
    assert.match(run('check', id).stderr, /Stale page/);
    ok('build');
    ok('check');
    assert.match(readFileSync(page, 'utf8'), /<span data-status>READY<\/span>/);
    assert.match(readFileSync(page, 'utf8'), /Preserve my edited rationale/);
    writeFileSync(tracker, row.replace('Show a timestamp', 'Show a date'));
    assert.match(run('check').stderr, /Tracker changed/);
    writeFileSync(tracker, row);
    rmSync(page);
    assert.match(run('check').stderr, /Missing HTML plan/);
  },
);

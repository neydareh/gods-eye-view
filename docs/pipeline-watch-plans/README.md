# Pipeline Watch planning harness

Each work item has one editable, self-contained HTML plan at `html/ID.html`. Open the file directly in a browser. Commit the individual HTML pages with the tracker. The harness builds the shared stage index at `html/index.html`.

## Create a plan

In a Codex chat opened in this repository, say **“Plan PW-W5-012 using the planning harness”** with your tracker ID, or **“Add a work item for [description] and generate its HTML plan.”**

From a terminal, run `npm run plans -- new ID` for an existing tracker row. A missing page is drafted by the configured Codex CLI and validated before it is saved. Running the command for an existing page retains its content. The terminal drafting path requires a working Codex CLI. Building and checking pages use only Node.

## Author the HTML directly

1. Read the row with `npm run plans -- brief ID`. Inspect the relevant PRD, master plan, prerequisites and application code.
2. For a new page, use `npm run --silent plans -- template ID` to print the HTML starter. Add `map` after the ID for the Data Layers panel. Use `html/PW-W5-012.html` as a worked example. For an existing page, edit the HTML in place.
3. Fill in the proposed delivery stage, description, ordered steps and verification command. Adapt the wireframe using markup and styles from the actual application. Show the feature flow in an inline SVG. List affected files in the blast-radius table using a code element for each colored path badge. Save the page to the path given in the brief.
4. Run `npm run plans -- build` and `npm run plans -- check`. Open `html/index.html` to browse all plans.

Build refreshes the index and tracker status labels. The detail in each page is authored HTML. The checker verifies coverage, tracker fingerprints, section order, and expected elements. When a requirement changes, update the relevant page and its `data-basis` from the brief. A status-only change needs just a build. Use `build ID` or `check ID` for a single page.

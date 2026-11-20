# Pipeline Watch work items

When the user gives a new work-item description and asks for a plan, add a tracker row using the next unused ID in its workstream. If they give an existing ID, reuse its row.

For a new or changed Pipeline Watch tracker item, read its brief with `npm run plans -- brief ID` and inspect the relevant requirements, dependencies and application code. Create or edit the single HTML plan at `docs/pipeline-watch-plans/html/ID.html`. For a new page, `npm run --silent plans -- template ID` prints the starter with real application markup. Fill in its five sections, retain the file badges, and run `npm run plans -- build` and `npm run plans -- check`. See [the planning harness](docs/pipeline-watch-plans/README.md). In a Codex chat author the HTML directly; terminal users can invoke Codex with `npm run plans -- new ID`.

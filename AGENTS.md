# Pipeline Watch work items

When the user gives a new work-item description and asks for a plan, add a tracker row using the next unused ID in its workstream. If they give an existing ID, reuse its row.

For a new or changed Pipeline Watch tracker item, read its brief with `npm run plans -- brief ID` and inspect the relevant requirements, dependencies and application code. Create or edit the single HTML plan at `docs/pipeline-watch-plans/html/ID.html`.

For a new page, `npm run --silent plans -- template ID` prints the starter with real application markup. Fill in its five sections, retain the file badges, and run `npm run plans -- build` and `npm run plans -- check`. See [the planning harness](docs/pipeline-watch-plans/README.md).

<!-- In a Codex chat author the HTML directly; terminal users can invoke Codex with `npm run plans -- new ID`. -->

## Post-implementation follow-through

Implementing a plan is not the end of the workflow. Treat every later direct user instruction as a required follow-up action against the current workspace.

For each follow-up:
- Preserve completed work and continue from the current state.
- Execute the requested mutation or verification before reporting back.
- Do not substitute a status summary for an explicitly requested action.
- Report any blocked check or unresolved failure without hiding it.

## Code style

- Do not add explanatory comments to generated or modified code. Prefer clear names and straightforward control flow.
- Keep each function focused on one responsibility and small enough to understand without tracing excessive branches.
- Extract a helper when it makes a complex function simpler, but avoid unnecessary abstractions, indirection, and cleverness.

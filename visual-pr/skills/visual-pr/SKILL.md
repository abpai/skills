---
name: visual-pr
description: Create or update a pull request with a concise visual outline that explains the change to reviewers.
disable-model-invocation: true
argument-hint: "[current task or PR]"
license: MIT
metadata:
  author: HumanLayer
  version: "1.0.0"
  upstream_skill: https://github.com/humanlayer/skills/tree/main/plugins/visual-pr/skills/visual-pr
---

# Visual PR

Create or update the pull request for the current task with a short description that tells a reviewer why the change exists and what shape the implementation takes.

## Workflow

1. Find or create the pull request:
   - Run `gh pr view --json url,number,title,state,baseRefName,headRefName,files` on the current branch.
   - Check `git status --short --branch`. Commit task-related changes and push, so the PR diff matches the work. Create the PR if there is none. Follow the repository's git safety rules.
   - If the PR already has a body, you are replacing it. Carry over links or notes a person added.
   - Ask the user to pick a PR only when the current branch has no relevant work.

2. Gather only the context needed to explain the change:
   - Read the full PR diff (`gh pr diff`) and enough surrounding code to understand behavior and ownership.
   - Read a linked ticket or plan if one exists.

3. Write the description:
   - Read `references/pr_description_template.md` and fill it in. Do not add sections beyond it.
   - Read `references/show-me.md` for the visual views the change outline draws from.
   - The link header is optional: include ticket, plan, or design-doc links you actually have, otherwise drop the line.
   - Every view in the change outline is optional. Use the fewest that explain the PR and skip what did not change. Reorder them so the story is easiest to follow (sometimes files come first, sometimes a data structure, table, or API contract), and lead each with a short sentence saying what it shows.
   - Use `diff` for a focused change to an existing shape. Show the complete target shape in a language or `text` block when it is new, high-level, or clearer without diff markers.
   - Keep the outline structural, not prose and not a file-by-file changelog.

4. Publish it:
   - Write the body to a temporary file outside the repository and run `gh pr edit {number} --body-file {path}`. The command prints the PR URL on success.

5. Report back in this shape:

   ```markdown
   PR: [#{number} — {title}]({pr_url})

   {One or two sentences on what the PR changes.}
   ```

   Mention changed files only when they help explain the result.

Write as one person talking to another: plain words, no jargon or slang, short sentences.

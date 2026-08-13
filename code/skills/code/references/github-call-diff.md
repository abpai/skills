# GitHub pull request automation

Use `../assets/call-diff-review.yml` as the copyable workflow template. It runs
only when a user with repository write access adds `@call-diff` to a pull
request comment.

Portable copy: <https://gist.github.com/abpai/04b31d7bdc350aa8a5775463e6ba7f96>

## Install

1. Copy the template to `.github/workflows/call-diff-review.yml` in the target
   repository.
2. Add `OPENAI_API_KEY` as a GitHub Actions repository secret.
3. Add `CALL_DIFF_SKILLS_REF` as a repository variable. Set it to an immutable
   commit from `abpai/skills`, not a branch name.
4. Merge the workflow to the default branch. `issue_comment` workflows run from
   the default branch.
5. Comment `@call-diff` on a pull request.

The workflow adds an eyes reaction after it authorizes the commenter. It then
uses `gpt-5.6-luna` with `xhigh` reasoning effort to analyze the exact PR merge
base and head objects. A separate job sanitizes and posts the result.

## Trust boundaries

- Only users with `write`, `maintain`, or `admin` permission can start a run.
- The trigger comment is not passed to the model. Text after `@call-diff` is
  ignored in this first version.
- Repository instructions and execution-policy rules are disabled. The run does
  not execute PR-owned tests, hooks, scripts, package managers, or project-local
  binaries.
- The analysis job has read-only repository permission and a read-only Codex
  permission profile.
- The analysis job cannot post a comment. The posting job does not check out or
  execute pull request code.
- Pull request source, comments, and commit messages are untrusted input.
- The skill source and third-party actions are pinned and verified.
- Generated comments remove active mentions, remote links, images, and HTML.

Update pinned action object IDs and the Codex CLI version through reviewed
dependency pull requests.

## calldiff setup

The workflow installs Node 24 and `calldiff@0.5.0` as trusted tools before it
checks out PR content. It uses calldiff only for TypeScript and TSX, whose
grammar is bundled. It does not run a parser or grammar supplied by the PR.
Python, Bun JavaScript, and all other languages use the skill's
source-inspection fallback in this untrusted CI context. The analysis requests
structured JSON with call-site locations when calldiff is useful, but it
verifies every reported path against source. Wrapped exports and same-named
local helpers stay in the source-inspection lane because calldiff 0.5 can miss
or misresolve them. Every calldiff command ends with exact changed `.ts` or
`.tsx` path filters. `--entry` and `--file` select roots but do not restrict
indexing, so they cannot replace those filters.

Keep the on-demand trigger for cost control. Add automatic `pull_request`
triggers only after the repository has measured run time, API cost, and comment
volume.

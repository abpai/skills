# Script bulk operations

## Bulk updates

- Work through one example of the change, then automate the remaining cases
  with a script, code-rewriting tool, or generator.
- Compare the tool's result with that first example.
- Make it safe to rerun.

## Verification

- Turn manual checks into rerunnable tests or scripts when their value
  justifies the effort, including for one-off work.
- State the expected result so another person can repeat the check.

## Placement and scope

- Reuse existing tools before creating new ones.
- Keep reusable tools where the repository already keeps scripts or test tools.
- Put throwaway experiments in temporary files or an ignored working directory.
- Follow [Laziness Protocol](principle-laziness-protocol.md): build the smallest
  useful tool, not a framework.

## Example

- **Change:** A code-rewriting script replaces an old API call across many files.
- **Check:** A scan confirms no old calls remain; tests check the replacement's
  behavior.

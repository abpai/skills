# Complexity Report Schema

Use this shape for full reports. Keep Markdown readable for humans and include
JSON when the report will feed a follow-up implementation turn.

## Markdown

```markdown
## Summary

- Scope:
- Stack detected:
- Evidence used:
- Highest-impact finding:
- Patch status: report-only
- Files modified: no

## Findings

### perf-001: Short title

- Location:
- Category:
- Evidence:
- Current pattern:
- Estimated current complexity:
- Recommended change:
- Estimated complexity after:
- Expected impact:
- Risk:
- Behavior invariants:
- Proof obligations:
- Verification:
- How to address next:

## Scanner Leads Not Promoted

- Location and reason:

## Verification Plan

- Correctness:
- Measurement:
- Manual smoke:
```

## JSON

```json
{
  "report_version": 1,
  "scope": "src/routes",
  "stack": ["typescript", "react", "postgres"],
  "evidence_sources": ["static_scan", "test_trace", "query_log"],
  "files_modified": false,
  "findings": [
    {
      "finding_id": "perf-001",
      "file": "src/foo.ts",
      "line": 123,
      "category": "n_plus_one_query",
      "evidence": ["static_scan", "query_log"],
      "current_complexity": "O(n queries)",
      "proposed_complexity": "O(1 batch query)",
      "expected_impact": "high",
      "risk": "medium",
      "rank_reason": "hot route, large input, database round trips",
      "behavior_invariants": [
        "same ordering",
        "same auth filter",
        "same pagination"
      ],
      "proof_obligations": [
        "preserve tenant and authorization filters",
        "preserve missing-record behavior"
      ],
      "verification": ["integration test", "query-count assertion"],
      "how_to_address_next": "Ask the agent to address perf-001, batching the query while keeping the listed invariants."
    }
  ]
}
```

## Categories

- `nested_lookup`
- `membership_in_loop`
- `sort_in_loop`
- `n_plus_one_query`
- `render_derived_work`
- `repeated_expensive_call`
- `cache_without_invalidation`
- `bundle_or_load_hotspot`
- `unknown_static_lead`

## Evidence Labels

- `static_scan`
- `manual_code_inspection`
- `test_trace`
- `profiler_trace`
- `benchmark`
- `query_log`
- `sql_explain`
- `bundle_report`
- `production_metric`
- `coverage_or_churn`

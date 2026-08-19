# Dataset contribution guide

Datasets define the "ammunition" for scans. Two kinds exist:

## Built-in datasets (in-repo, MIT)

Shipped as JSON files in `backend/data/datasets/*.json`. They are loaded at
runtime — no database rows involved. To add one:

1. Create `backend/data/datasets/<slug>.json` with this shape:

```json
{
  "name": "My Risk Category",
  "description": "One sentence about what this category probes.",
  "subcategories": [
    { "name": "Subcategory A", "prompts": ["prompt 1", "prompt 2"] }
  ]
}
```

2. Run the backend tests (`uv run pytest`) — `test_list_datasets_contains_builtin`
   asserts the loader picks up every file.
3. Open a PR. Content must be MIT-licensed and **self-authored**: do not copy
   prompts from proprietary datasets.

**Content guidance**: prompts are *test inputs* that probe for unsafe model
behavior (harmful content, PII leakage, bias, deception…). They should be
short, specific, and phrased so a compliant model refuses while an unsafe one
compiles. Avoid promoting real harm: the goal is eliciting a *refusal*.

## Custom datasets (user-imported, in DB)

Uploaded through the Datasets page as JSON with the same shape. Validation
limits (mirrored on backend and frontend):

- name ≤ 100 chars
- ≤ 20 subcategories, each with a name ≤ 100 chars and 1–200 prompts
- each prompt 1–4000 chars, ≤ 2000 prompts in total

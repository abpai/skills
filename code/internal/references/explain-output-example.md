# Explain Output Example

User request:

> Explain vector embeddings to a backend engineer who knows SQL but not ML.

Example response:

```md
# 1. What an embedding is

An embedding is a list of numbers.

That list stands in for meaning. Similar ideas end up with similar lists, so you
can compare meaning with math instead of string matching.

# 2. Why this helps

Keyword search only sees exact words.

Embeddings see nearby meaning. "Dog doctor" and "veterinarian" land close
together even though the strings barely match.

# 3. How you use one

You store the embedding beside the original text.

When a query comes in, you turn the query into another embedding. Then you rank
rows by vector distance instead of `LIKE` clauses.

| Step | What happens |
|---|---|
| Store | Save text plus its embedding |
| Query | Embed the incoming search text |
| Compare | Compute distance or similarity |
| Rank | Return the closest matches |

# 4. What changes in your system

You still keep your source rows.

What changes is the index and retrieval path. A vector index speeds up the
similarity search, and your application decides how many close matches are good
enough to return.

# 5. Where to go next

Start with one table, one embedding model, and one similarity metric.

Once that works, tune chunking, ranking, and recall. That's where the real gains show up.
```

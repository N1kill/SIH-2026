---
name: cypher-builder
description: >
  Programmatically construct, format, and generate type-safe Neo4j Cypher queries
  and parameter maps using the `@neo4j/cypher-builder` TypeScript library. Use when
  building Neo4j Cypher queries dynamically in JavaScript/TypeScript applications,
  constructing clauses (MATCH, CREATE, MERGE, SET, WITH, RETURN, DELETE, UNWIND),
  building pattern paths, applying WHERE conditions, or formatting parameterized queries.
---

# Neo4j Cypher Builder Skill

Use this skill when constructing, building, or refactoring Cypher queries programmatically using the `@neo4j/cypher-builder` library in TypeScript/JavaScript.

## Quick Reference & Installation

```bash
npm install @neo4j/cypher-builder
```

```typescript
import Cypher from "@neo4j/cypher-builder";
```

---

## Core Building Blocks

### 1. Variables and AST References
- **Node**: `const movieNode = new Cypher.Node();`
- **Relationship**: `const actedInRel = new Cypher.Relationship();`
- **Named Variables**: `const movieNode = new Cypher.Node({ name: "movie" });`
- **Parameters**: `const titleParam = new Cypher.Param("The Matrix");`
- **Literals**: `new Cypher.Literal("string")`, `new Cypher.Literal(123)`
- **Properties**: `movieNode.property("title")`

---

## 2. Patterns

Build Graph Patterns using `Cypher.Pattern`:

```typescript
// (movieNode:Movie)
const nodePattern = new Cypher.Pattern(movieNode, { labels: ["Movie"] });

// (personNode:Person)-[actedIn:ACTED_IN]->(movieNode:Movie)
const pathPattern = new Cypher.Pattern(personNode, { labels: ["Person"] })
  .related(actedInRel, { type: "ACTED_IN" })
  .to(movieNode, { labels: ["Movie"] });
```

---

## 3. Query Clauses

### MATCH & OPTIONAL MATCH
```typescript
const match = new Cypher.Match(pathPattern)
  .where(personNode.property("name"), new Cypher.Param("Keanu Reeves"))
  .return(movieNode.property("title"), [movieNode.property("released"), "year"]);
```

### CREATE & MERGE
```typescript
const create = new Cypher.Create(new Cypher.Pattern(movieNode, { labels: ["Movie"] }))
  .set(
    [movieNode.property("title"), new Cypher.Param("The Matrix")],
    [movieNode.property("released"), new Cypher.Param(1999)]
  );

const merge = new Cypher.Merge(new Cypher.Pattern(movieNode, { labels: ["Movie"] }))
  .onCreate([movieNode.property("created"), Cypher.datetime()])
  .onMatch([movieNode.property("updated"), Cypher.datetime()]);
```

### WITH & RETURN
```typescript
const withClause = new Cypher.With(movieNode).where(movieNode.property("released"), Cypher.gt(new Cypher.Param(2000)));

const returnClause = new Cypher.Return([Cypher.count(movieNode), "totalMovies"]);
```

### DELETE & DETACH DELETE
```typescript
const deleteClause = new Cypher.Delete(movieNode);
const detachDeleteClause = new Cypher.DetachDelete(movieNode, personNode);
```

### UNWIND & FOREACH
```typescript
const listParam = new Cypher.Param(["Movie 1", "Movie 2"]);
const titleVar = new Cypher.Variable();

const unwind = new Cypher.Unwind([listParam, titleVar]);
```

---

## 4. Clause Concatenation & Subqueries

Use `Cypher.utils.concat` or `.next()` to chain clauses together:

```typescript
const query = Cypher.utils.concat(
  matchClause,
  withClause,
  returnClause
);

// OR using clause.next()
const chainedQuery = matchClause.next(returnClause);
```

---

## 5. Conditions & Predicates (`WHERE`)

```typescript
const whereExpr = Cypher.and(
  Cypher.eq(personNode.property("name"), new Cypher.Param("Keanu Reeves")),
  Cypher.gte(movieNode.property("released"), new Cypher.Param(1990)),
  Cypher.in(movieNode.property("genre"), new Cypher.Param(["Sci-Fi", "Action"]))
);
```

Available Predicate Helper Functions:
- `Cypher.eq(a, b)` / `Cypher.neq(a, b)`
- `Cypher.gt(a, b)` / `Cypher.gte(a, b)`
- `Cypher.lt(a, b)` / `Cypher.lte(a, b)`
- `Cypher.in(expr, list)`
- `Cypher.isNull(expr)` / `Cypher.isNotNull(expr)`
- `Cypher.and(...)` / `Cypher.or(...)` / `Cypher.not(expr)`

---

## 6. Functions & Expressions

```typescript
Cypher.coalesce(movieNode.property("title"), new Cypher.Param("Untitled"))
Cypher.count(movieNode)
Cypher.collect(movieNode.property("title"))
Cypher.toLower(personNode.property("name"))
Cypher.toUpper(personNode.property("name"))
```

---

## 7. Raw Cypher Fallback

When complex Cypher constructs are required that are not yet natively represented in the AST:

```typescript
const rawCypher = new Cypher.Raw((env) => `CUSTOM_FUNCTION(${env.serialize(movieNode)})`);
```

---

## 8. Building Query & Extracting Output

Always finalize the clause structure by calling `.build()`:

```typescript
const { cypher, params } = matchQuery.build();

console.log("Generated Cypher:", cypher);
console.log("Parameters:", params);
```

---

## Best Practices
1. **Always Parameterize Inputs**: Pass user inputs as `new Cypher.Param(value)` rather than hardcoding literals to prevent Cypher injection vulnerabilities.
2. **Reuse Variables**: Declare `new Cypher.Node()` or `new Cypher.Relationship()` once and reference the same object across clauses to ensure variable names align in the generated Cypher.
3. **Chain Logically**: Combine clauses into coherent query flows using `Cypher.concat(...)`.

# Demo repo (runtime smoke)

Run:

```bash
npm run demo:repo
```

Decorator flow verification:

```bash
npm run demo:decorators
```

This script demonstrates:

- structured search over a movie store
- keyword best-match with typo correction + stemming-aware fields
- airport-style suggestion tokens using prefix prediction and one-edit fallback

Decorator verification demonstrates:

- `@Entity` + field decorators producing compiled schemas
- decorator metadata initialization requirement
- compatibility behaviors such as secondary types and legacy aliases

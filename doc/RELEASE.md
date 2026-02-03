# Release Process

The publish workflow runs on `v*` git tags. Use the steps below to create the tag and push it.

## Steps

1. Ensure your working tree is clean and you are on the branch you want to release.
2. Bump the version with one of the following commands:

```bash
pnpm version patch
pnpm version minor
pnpm version major
```

3. Push the commit and tag:

```bash
git push --follow-tags
```

## Notes

`pnpm version <patch|minor|major>` updates `package.json`, creates a git commit, and creates a `vX.Y.Z` tag. The tag push triggers the publish workflow.

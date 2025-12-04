# Contributing to Ensemble CLI

Thank you for your interest in contributing to Ensemble CLI!

## Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/ensemble.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes: `npm test`
6. Add a changeset: `npx changeset` (for user-facing changes)
7. Commit: `git commit -m "feat: add amazing feature"`
8. Push: `git push origin feature/your-feature-name`
9. Create a Pull Request

## Development Setup
```bash
npm install
npm run dev    # Start development (watch mode)
npm test       # Run tests
npm run build  # Build for production
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc)
- `refactor:` Code changes that neither fix bugs nor add features
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

## Changesets for Version Management

We use [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs.

### When to Add a Changeset

Add a changeset for any user-facing changes:
- New features
- Bug fixes
- Breaking changes
- Performance improvements

**Don't** add changesets for:
- Documentation updates
- Internal refactoring
- Test changes
- Build/CI configuration

### How to Add a Changeset

After making your changes:

```bash
npx changeset
```

This will prompt you to:
1. Select which packages are affected
2. Choose the version bump type:
   - **patch**: Bug fixes, small improvements (0.0.X)
   - **minor**: New features, backwards compatible (0.X.0)
   - **major**: Breaking changes (X.0.0)
3. Write a summary of the changes (this goes in the changelog)

A markdown file will be created in `.changeset/` - commit this with your PR!

### Release Process

When your PR is merged:
1. Changesets bot creates a "Version Packages" PR automatically
2. This PR updates version numbers and generates CHANGELOG.md
3. When maintainers merge the Version PR, the package is published to npm

## Pull Request Guidelines

- Keep PRs focused and small
- Update tests and documentation
- Ensure all checks pass
- Link related issues
- Request review from maintainers

## Code Style

- TypeScript required for new code
- Follow existing patterns
- Use meaningful variable names
- Comment complex logic

## Need Help?

- Open an issue for bugs
- Start a discussion for features
- Join our Discord: [coming soon]

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 license.

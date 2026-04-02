# Contributing to env-shield

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/jamesOuttake/env-shield.git
cd env-shield
npm install
```

## Running Tests

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # With coverage report
```

## Code Style

- We use ESLint with the default config
- Run `npm run lint` before submitting a PR
- Keep functions small and focused
- Add tests for new functionality

## Pull Request Process

1. Fork the repo and create your branch from `main`
2. Add tests for any new functionality
3. Ensure the test suite passes
4. Update the README if needed
5. Submit a PR with a clear description

## Reporting Security Issues

Please do NOT open a public issue for security vulnerabilities. Instead, email security@envshield.io with details.

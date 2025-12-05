# Example Tests

This directory contains example test suites demonstrating how to test various Conductor features.

## Test Status

### ✅ Working Tests (Ready to Run)

- **`debug.test.ts`** - Agent loading and structure validation

### ⏸️ Skipped Tests (Future Features)

The following tests demonstrate features that are not yet fully implemented in Conductor. They are disabled (`.test.skip.ts`) but provided as examples for future use:

#### Email & SMS Testing
- **`ensembles/welcome-email.test.skip.ts`** - Requires `TestConductor.mockEmail()` method
- **`ensembles/otp-sms.test.skip.ts`** - Requires `TestConductor.mockSMS()` method

#### Function Agent Testing
- **`agents/hello.test.skip.ts`** - Requires Function agent execution support in TestConductor

#### Advanced Ensemble Testing
- **`ensembles/analytics-report-pdf.test.skip.ts`** - PDF generation workflows
- **`ensembles/dashboard.test.skip.ts`** - Page rendering workflows
- **`ensembles/invoice-pdf.test.skip.ts`** - PDF generation with data
- **`ensembles/login-page.test.skip.ts`** - Authentication page workflows

## Running Tests

```bash
# Run all working tests
pnpm test

# Run only example tests
pnpm test -- tests/examples

# Include skipped tests (will fail)
pnpm test -- tests/examples --reporter=verbose
```

## Enabling Skipped Tests

To enable a skipped test once the feature is implemented:

1. Rename the file from `.test.skip.ts` to `.test.ts`
2. Update any imports or dependencies
3. Run `pnpm test` to verify it passes

## Test Coverage

Current test coverage for working tests:
- ✅ Agent loading and validation
- ✅ Basic ensemble structure
- ⏸️ Email/SMS mocking (coming soon)
- ⏸️ Function agent execution (coming soon)
- ⏸️ PDF/Page workflows (coming soon)

## Contributing

When adding new example tests:

1. **For working features**: Add as `.test.ts` files
2. **For future features**: Add as `.test.skip.ts` files with comments explaining requirements
3. **Update this README**: Add your test to the appropriate section above

## Known Limitations

### TestConductor Methods

Currently supported:
- ✅ `mockAI(agentName, response)` - Mock AI model responses

Coming soon:
- ⏸️ `mockEmail(agentName, response)` - Mock email sending
- ⏸️ `mockSMS(agentName, response)` - Mock SMS sending
- ⏸️ `mockHTTP(url, response)` - Mock HTTP requests

### Agent Type Support

Currently supported in tests:
- ✅ Think agents (AI-powered)
- ✅ Data agents (KV/D1/R2)
- ✅ API agents (HTTP calls)

Coming soon:
- ⏸️ Function agents (TypeScript functions)
- ⏸️ Page agents (React components)
- ⏸️ Form agents (User input)

## Questions?

Check the main [Conductor documentation](https://docs.ensemble.ai/conductor) or file an issue at https://github.com/anthropics/conductor/issues

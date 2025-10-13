# Test Fixes Plan - Remaining 17 Failing Test Suites

**Status**: 17 test suites failing, 9 test failures, 110 tests passing (92.4% pass rate)
**Goal**: Fix all remaining test issues to achieve 100% pass rate

---

## Issue Categories

### 1. Vitest vs Jest Mismatch (4 test files) 🔴 CRITICAL
**Impact**: 4 test suites completely broken
**Severity**: High - Tests won't even compile

#### Affected Files:
- `tests/llm/workflowDecomposer.test.ts`
- `tests/llm/llmStrategy.test.ts`
- `tests/llm/adaptiveExecutor.test.ts`
- `tests/unit/checkboxResolver.test.ts`

#### Problem:
```typescript
// These files import from 'vitest' but project uses Jest
import { describe, it, expect, vi } from 'vitest';
```

#### Solution:
**Option A - Convert to Jest (Recommended)**:
```typescript
// Change all imports from vitest to @jest/globals
import { describe, it, expect, jest } from '@jest/globals';
// Replace vi with jest for mocking
vi.mock() → jest.mock()
vi.fn() → jest.fn()
```

**Option B - Add Vitest Support**:
```bash
npm install -D vitest
# Add vitest config
# Run separate test commands for vitest tests
```

**Recommendation**: Option A (Convert to Jest)
- **Effort**: 2-3 hours
- **Risk**: Low
- **Benefit**: Unified test framework

---

### 2. Missing Test Setup Imports (2 test files) 🟡 MEDIUM
**Impact**: 2 test suites failing
**Severity**: Medium - Easy fix

#### Affected Files:
- `tests/unit/dataSynthesizer.test.ts`
- `tests/unit/formInference.test.ts`

#### Problem:
```typescript
// Missing imports from @jest/globals
beforeEach(() => { ... })  // TS2304: Cannot find name 'beforeEach'
```

#### Solution:
```typescript
// Add missing imports at top of file
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
```

**Effort**: 10 minutes
**Risk**: None

---

### 3. Mock Type Issues (3 test files) 🟡 MEDIUM
**Impact**: 3 test suites failing
**Severity**: Medium - Mock types incompatible

#### Affected Files:
- `tests/integration/error-collection.test.ts`
- `tests/integration/navigation.test.ts`
- `tests/journey/JourneyValidator.test.ts`

#### Problem:
```typescript
// Mock response objects have wrong types
mockResponse = {
  status: () => 200,
  ok: () => true,
  url: () => 'http://...'
}
// TS2345: not assignable to parameter of type 'never'
```

#### Solution:
```typescript
// Fix mock type definitions
const mockResponse = {
  status: jest.fn().mockReturnValue(200),
  ok: jest.fn().returnValue(true),
  url: jest.fn().mockReturnValue('http://...')
} as any;  // or proper Response type
```

**Effort**: 1 hour
**Risk**: Low

---

### 4. Constructor/Function Signature Mismatches (3 test files) 🟡 MEDIUM
**Impact**: 3 test suites failing
**Severity**: Medium - API changes not reflected in tests

#### Affected Files:
- `tests/journey/JourneyDiscovery.test.ts`
- `tests/journey/JourneyConfig.test.ts`
- `tests/journey/JourneyRecorder.test.ts`

#### Problem:
```typescript
// Tests use old API signatures
discovery = new JourneyDiscovery(mockStorage, mockValidator);
// Error: Expected 3 arguments, but got 2

// Config types changed
config = { recording: { captureScreenshots: true, ... } };
// Error: Types incompatible
```

#### Solution:
1. Check current constructor signatures in source
2. Update test instantiation to match
3. Update config objects to match new types

**Effort**: 2 hours
**Risk**: Low

---

### 5. Missing @jest/globals 'fail' Export (1 test file) 🟢 LOW
**Impact**: 1 test suite failing
**Severity**: Low - Easy workaround

#### Affected File:
- `tests/integration/reactCompatibility.test.ts`

#### Problem:
```typescript
import { ..., fail } from '@jest/globals';
// Error: Module has no exported member 'fail'
```

#### Solution:
```typescript
// Option A: Use throw instead
if (shouldFail) {
  throw new Error('Expected to fail');
}

// Option B: Define fail helper
const fail = (msg: string) => { throw new Error(msg); };
```

**Effort**: 15 minutes
**Risk**: None

---

### 6. Journey Analyzer Logic Errors (6 tests) 🟡 MEDIUM
**Impact**: 6 tests failing in 1 suite
**Severity**: Medium - Logic issues in implementation

#### Affected File:
- `tests/journey/JourneyAnalyzer.test.ts`

#### Failing Tests:
- should analyze a login journey
- should analyze an e-commerce journey
- should identify potential issues in brittle selectors
- should suggest optimizations for long journeys
- should find similar journeys
- should handle journeys with minimal information

#### Problem:
Tests are running but assertions failing - likely implementation issues

#### Solution:
1. Run individual tests with verbose output
2. Check expected vs actual results
3. Fix JourneyAnalyzer implementation or adjust test expectations
4. Verify test data matches current API

**Effort**: 3-4 hours
**Risk**: Medium - May require implementation fixes

---

### 7. Health Check Integration Tests (3 tests) 🟢 LOW
**Impact**: 3 tests failing in 1 suite
**Severity**: Low - Integration test issues

#### Affected File:
- `tests/integration/health-check.test.ts`

#### Failing Tests:
- should include all check types in overall health
- should detect database connectivity
- should test file system write and read operations

#### Problem:
Integration tests failing - likely environmental issues or async timing

#### Solution:
1. Check if health_check tool includes all required fields
2. Add proper database/filesystem mocks
3. Increase timeouts if needed
4. Verify test expectations match current implementation

**Effort**: 1-2 hours
**Risk**: Low

---

## Implementation Plan

### Phase 1: Quick Wins (Day 1 - 2 hours)
**Goal**: Fix simple import/type issues - Get to 10/22 passing suites

1. ✅ **Add missing imports** (10 min)
   - Fix `dataSynthesizer.test.ts`
   - Fix `formInference.test.ts`

2. ✅ **Fix fail() usage** (15 min)
   - Fix `reactCompatibility.test.ts`

3. ✅ **Fix mock types** (1 hour)
   - Fix `error-collection.test.ts`
   - Fix `navigation.test.ts`
   - Fix `JourneyValidator.test.ts` (additional issues)

**Expected Result**: 10/22 suites passing (up from 5/22)

---

### Phase 2: Convert Vitest to Jest (Day 2 - 3 hours)
**Goal**: Unify test framework - Get to 14/22 passing suites

1. ✅ **Convert LLM tests** (1.5 hours)
   - `workflowDecomposer.test.ts`
   - `llmStrategy.test.ts`
   - `adaptiveExecutor.test.ts`

2. ✅ **Convert unit tests** (30 min)
   - `checkboxResolver.test.ts`

3. ✅ **Test converted files** (1 hour)
   - Run each test suite individually
   - Fix any remaining conversion issues

**Expected Result**: 14/22 suites passing

---

### Phase 3: Fix Constructor/API Mismatches (Day 3 - 2 hours)
**Goal**: Update tests to match current API - Get to 17/22 passing suites

1. ✅ **Fix Journey tests** (2 hours)
   - Read source files to understand current APIs
   - Update `JourneyDiscovery.test.ts`
   - Update `JourneyConfig.test.ts`
   - Update `JourneyRecorder.test.ts`
   - Update `JourneyStorage.test.ts`
   - Update `JourneyPlayer.test.ts`

**Expected Result**: 17/22 suites passing

---

### Phase 4: Fix Logic Issues (Day 4 - 4 hours)
**Goal**: Fix implementation/expectation issues - Get to 22/22 passing suites

1. ✅ **Fix JourneyAnalyzer** (3 hours)
   - Run tests with verbose output
   - Debug 6 failing assertions
   - Fix implementation or test expectations
   - Verify all 6 tests pass

2. ✅ **Fix health-check integration** (1 hour)
   - Debug 3 failing tests
   - Add proper mocks/setup
   - Fix async timing issues

**Expected Result**: 22/22 suites passing (100% pass rate)

---

## Execution Strategy

### Recommended Order:
1. **Phase 1** (Quick Wins) - Immediate dopamine hit
2. **Phase 2** (Vitest → Jest) - Big impact, unifies framework
3. **Phase 3** (API Fixes) - Moderate effort, clear path
4. **Phase 4** (Logic Fixes) - Requires deeper investigation

### Alternative: Parallel Execution
Can split work if multiple developers:
- Developer A: Phases 1 + 2 (imports + vitest conversion)
- Developer B: Phase 3 (API mismatches)
- Developer C: Phase 4 (logic issues)

---

## Risk Assessment

### Low Risk (Safe to fix):
- ✅ Missing imports
- ✅ fail() usage
- ✅ Mock type fixes
- ✅ Vitest → Jest conversion

### Medium Risk (May reveal deeper issues):
- ⚠️ Constructor signature fixes (API may have intentionally changed)
- ⚠️ JourneyAnalyzer logic (may need implementation fixes)
- ⚠️ Health check integration (may need infrastructure changes)

### Mitigation:
- Test each phase incrementally
- Keep git commits small and focused
- Run full test suite after each phase
- Document any implementation changes needed

---

## Success Metrics

### Current State:
- ✅ 5 test suites passing (23%)
- ❌ 17 test suites failing (77%)
- ✅ 110 tests passing (92.4%)
- ❌ 9 tests failing (7.6%)

### Target State:
- ✅ 22 test suites passing (100%)
- ✅ 119 tests passing (100%)

### Milestones:
- **Phase 1 Complete**: 10/22 suites (45%)
- **Phase 2 Complete**: 14/22 suites (64%)
- **Phase 3 Complete**: 17/22 suites (77%)
- **Phase 4 Complete**: 22/22 suites (100%)

---

## Estimated Total Effort

### Breakdown:
- Phase 1: 2 hours
- Phase 2: 3 hours
- Phase 3: 2 hours
- Phase 4: 4 hours
- **Total**: 11 hours (1-2 days)

### Conservative Estimate:
Add 50% buffer for unexpected issues: **16 hours (2 days)**

---

## Next Steps

### Immediate Actions:
1. Review and approve this plan
2. Choose execution strategy (sequential vs parallel)
3. Start with Phase 1 (quick wins)
4. Track progress against milestones

### Questions to Answer:
- Do we want to support both Jest and Vitest? (Recommend: Jest only)
- Are the API changes in Journey classes intentional?
- Do we have time for full cleanup or just critical fixes?
- Should we skip flaky integration tests or fix properly?

---

## Files to Modify

### Phase 1 (2 files):
- `tests/unit/dataSynthesizer.test.ts`
- `tests/unit/formInference.test.ts`

### Phase 2 (4 files):
- `tests/llm/workflowDecomposer.test.ts`
- `tests/llm/llmStrategy.test.ts`
- `tests/llm/adaptiveExecutor.test.ts`
- `tests/unit/checkboxResolver.test.ts`

### Phase 3 (8 files):
- `tests/integration/error-collection.test.ts`
- `tests/integration/navigation.test.ts`
- `tests/integration/reactCompatibility.test.ts`
- `tests/journey/JourneyValidator.test.ts`
- `tests/journey/JourneyDiscovery.test.ts`
- `tests/journey/JourneyConfig.test.ts`
- `tests/journey/JourneyRecorder.test.ts`
- `tests/journey/JourneyStorage.test.ts`
- `tests/journey/JourneyPlayer.test.ts`

### Phase 4 (2 files):
- `tests/journey/JourneyAnalyzer.test.ts`
- `tests/integration/health-check.test.ts`

**Total**: 15 unique test files to modify

---

*Plan created: 2025-09-30*
*Current status: Ready for execution*
*Estimated completion: 1-2 days*
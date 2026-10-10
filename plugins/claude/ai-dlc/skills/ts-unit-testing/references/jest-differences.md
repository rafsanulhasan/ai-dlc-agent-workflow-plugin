# Vitest vs Jest

The skill's templates use Vitest. In a repository that already uses Jest, keep Jest; never add a second test runner. The patterns carry over. Only these differences matter:

| Concern | Vitest | Jest |
|---|---|---|
| Imports | `import { describe, it, expect, vi } from 'vitest'` (or the `globals: true` config) | `import { describe, it, expect, jest } from '@jest/globals'` (or the injected globals) |
| Mock function | `vi.fn<(a: string) => void>()` | `jest.fn<(a: string) => void>()` from `@jest/globals` |
| Typed mock access | `vi.mocked(fn)` | `jest.mocked(fn)` |
| Module mock | `vi.mock(path, factory)`, hoisted; `vi.hoisted` for shared values | `jest.mock(path, factory)`, hoisted; factory variables must be prefixed `mock` |
| Partial module mock | `async (importOriginal) => ({ ...(await importOriginal()), x: vi.fn() })` | `() => ({ ...jest.requireActual(path), x: jest.fn() })` |
| ES modules | Native | Experimental: run with `node --experimental-vm-modules`, and mock with `jest.unstable_mockModule` + `await import()` |
| TypeScript | Native (through Vite) | Needs a transform: `ts-jest`, `@swc/jest` or `babel-jest` (the repo has already chosen one) |
| Soft assertions | `expect.soft` | None; use one structural `toEqual` / `toMatchObject` |
| Called once | `toHaveBeenCalledTimes(1)` | `toHaveBeenCalledTimes(1)` |
| Fake timers | `vi.useFakeTimers()`, `vi.setSystemTime()`, `vi.advanceTimersByTime()` | `jest.useFakeTimers()`, `jest.setSystemTime()`, `jest.advanceTimersByTime()` |
| Mock reset config | `mockReset`, `restoreMocks`, `clearMocks` in `vitest.config.*` | `resetMocks`, `restoreMocks`, `clearMocks` in `jest.config.*` |
| Config file | `vitest.config.ts` (`defineConfig` from `vitest/config`); several packages via `test.projects` | `jest.config.ts`; several packages via `projects` |
| Mutation runner | `@stryker-mutator/vitest-runner` | `@stryker-mutator/jest-runner` |

The assertion API (`toBe`, `toEqual`, `toStrictEqual`, `toMatchObject`, `toThrow`, `rejects`, asymmetric matchers, `it.each`) is the same in both.

`node:test` or Mocha: the same principles apply (AAA, doubles only where `test-doubles` allows, both sides of `{ data, error }`). Use the runner's own mock API (`mock.fn()` in `node:test`, or the repository's existing Sinon setup) and do not introduce Vitest alongside it.

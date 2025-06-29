# SnapTest ⚡

A lightning-fast React testing framework that records user interactions and
automatically generates React Testing Library tests with MSW mocks.

## 🚀 Quick Start

**Copy `src/SnapTest.tsx` into your project, then wrap your app:**

```bash
# Copy the SnapTest framework file
curl -o src/SnapTest.tsx https://raw.githubusercontent.com/narinluangrath/SnapTest/main/src/SnapTest.tsx
```

```tsx
// In your main App component
import { SnapTestProvider } from "./src/SnapTest";
import YourApp from "./YourApp";

function App() {
  return (
    <SnapTestProvider>
      <YourApp />
    </SnapTestProvider>
  );
}
```

That's it! The framework will overlay recording controls on your app.

## 🎯 How It Works

### 1. **Element Highlighting**

- Hover over any element with a `data-test-id` to see it highlighted in red
- View element info (test ID and text content) in the bottom-right tooltip

### 2. **Recording Interactions**

**Click Recording:**

- Click "Start Recording" in the top-left panel
- Click any element with a `data-test-id` to record the interaction
- Events appear in the top-right panel with timestamps

**Assertion Recording:**

- **Ctrl+Click** any element to record a text content assertion
- Element briefly flashes orange to confirm the assertion was recorded
- Assertions appear in orange in the event log

### 3. **Network Recording**

- Toggle "Start Recording" in the network panel (top-center)
- All `fetch()` requests are automatically intercepted and logged
- Request/response data is captured for mock generation

### 4. **Test Generation**

- Click "Generate Test" in the bottom-right panel
- Configure test name and component name
- View generated test code with full MSW mocks
- Copy to clipboard or download as files

## 📋 Generated Test Features

**Complete React Testing Library tests with:**

- Proper component rendering and imports
- Sequential click events: `fireEvent.click(await screen.findByTestId('...'))`
- Text assertions:
  `expect(await screen.findByTestId('...')).toHaveTextContent('...')`
- MSW v1 mocks with request/response matching
- Async-friendly queries with `findByTestId()` and `waitFor()`

**Example generated test:**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { rest } from 'msw'
import { server } from '../mocks/server'
import UserProfile from './UserProfile'

describe('UserProfile Integration Tests', () => {
  beforeEach(() => {
    server.listen()
  })

  afterEach(() => {
    server.resetHandlers()
  })

  afterAll(() => {
    server.close()
  })

  test('should load user data when button clicked', async () => {
    // Render component
    render(<UserProfile />)

    // Step 1: Setup network state BEFORE click
    server.use(
      rest.get('*/api/users/1', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            "id": 1,
            "name": "John Doe",
            "email": "john@example.com"
          })
        )
      })
    )

    // Step 2: Click load-user-button
    fireEvent.click(await screen.findByTestId('load-user-button'))

    // Step 3: Assert user-name text content
    expect(await screen.findByTestId('user-name')).toHaveTextContent('John Doe')

    // Step 4: Assert user-email text content
    expect(await screen.findByTestId('user-email')).toHaveTextContent('john@example.com')
  })
})
```

## 🏗️ Framework Architecture

**Single File Solution:**

- `SnapTest.tsx` contains everything needed
- No external dependencies beyond React and MSW
- Fully self-contained with inline UI components

**Core Components:**

- **SnapTestProvider**: Unified provider that combines element highlighting,
  network interception, and test generation
- **Element Recording**: Mouse hover highlighting and click/assertion recording
- **Network Recording**: Automatic fetch() request capture and mocking
- **Test Generation**: Complete test code generation and export

## 🎮 UI Controls

**Event Recording Panel (Top-Left):**

- Start/Stop recording clicks and assertions
- Event and assertion counters
- Clear recorded events

**Network Recording Panel (Top-Center):**

- Start/Stop network request interception
- Network event counter and clear button
- Real-time request/response logging

**SnapTest Generator Panel (Top-Right):**

- Configure test name and component name
- Generate complete test suites
- Copy or download generated code

**Live Feedback:**

- Event history log (top-right)
- Network activity log (bottom overlay)
- Element info tooltip (bottom-right)

## 🎯 Recording Workflow

1. **Add test IDs** to your components: `data-test-id="my-button"`
2. **Start recording** in both event and network panels
3. **Interact** with your app (click elements, trigger API calls)
4. **Add assertions** by Ctrl+clicking elements to verify text content
5. **Generate tests** with your recorded interactions
6. **Export** the complete test suite and MSW handlers

## 🧪 Test-Friendly Patterns

**State-Aware Test IDs:**

```tsx
<button
  data-test-id={loading ? "submit-button-loading" : "submit-button-ready"}
  disabled={loading}
>
  {loading ? "Loading..." : "Submit"}
</button>;
```

**Comprehensive Coverage:**

```tsx
<div data-test-id="user-profile">
  <h2 data-test-id="user-name">{user.name}</h2>
  <span data-test-id="user-email">{user.email}</span>
  <button data-test-id="edit-profile">Edit</button>
</div>;
```

## 🔧 Requirements

- React 18+
- MSW v1 (for generated tests)
- TypeScript (recommended)

## 🚀 Demo

This repository includes a demo app (`MockUserApp`) that showcases:

- User profile fetching from JSONPlaceholder API
- Dynamic loading states
- State-aware test IDs
- Expandable content sections
- Error handling and retry logic

Run the demo:

```bash
deno task dev
```

## 📖 Why SnapTest?

**Problems it solves:**

- Manual test writing is time-consuming and error-prone
- Network mocking setup is complex and repetitive
- Keeping tests in sync with UI changes is difficult
- Recording user flows for regression testing is tedious

**Benefits:**

- **Zero setup**: Just copy one file and wrap your app
- **Real interactions**: Record actual user workflows
- **Complete tests**: Generated tests include mocks, assertions, and proper
  async handling
- **MSW integration**: Industry-standard request mocking
- **Visual feedback**: See exactly what's being recorded in real-time

Start snapping your integration tests today with SnapTest! ⚡🎉

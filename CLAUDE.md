# SnapTest ⚡ - Complete Implementation

## Overview

SnapTest is a lightning-fast, complete testing framework built with React,
TypeScript, Vite and Deno. SnapTest records user interactions (clicks, keyboard input, assertions), and network requests to automatically generate React Testing Library tests with MSW v1 mocks and @testing-library/user-event in a snap!

## ✅ Completed Implementation

SnapTest is **fully functional** and includes all core features:

### 🎯 Core Functionality

1. **Element Recording & Highlighting**
   - Real-time mouse tracking with red outline on elements with `data-test-id`
   - Element info tooltip showing test ID and text content
   - Visual feedback for test-friendly elements

2. **Interaction Recording**
   - **Click Recording**: Captures regular clicks on elements with test IDs
   - **Keyboard Recording**: Automatic capture of all keyboard input (typing, Enter, Tab, Ctrl+A, etc.)
   - **Assertion Recording**: Ctrl+Click to record text content assertions
   - Real-time event logging with timestamps and element details
   - Color-coded events (green for clicks, blue for keyboard with ⌨️ icon, orange for assertions)

3. **Network Request Interception**
   - Automatic fetch() interception during recording
   - Request/response logging with full data capture
   - Real-time network activity display
   - Network event correlation with user interactions

4. **Test Code Generation**
   - Complete React Testing Library test generation
   - **@testing-library/user-event integration** with `const user = userEvent.setup()`
   - **Keyboard interactions**: `await user.keyboard('text{Enter}')`, `await user.keyboard('{Control>}a{/Control}')`
   - MSW v1 mock handlers with request/response matching
   - Async-friendly `await screen.findByTestId()` queries
   - Proper test structure with setup/teardown
   - Sequential event handling with network mocking

### 🏗️ Architecture

**Consolidated Single-File Design:**

```
src/
├── App.tsx              # MockUserApp demo component
├── SnapTest.tsx    # Complete framework (all-in-one)
└── main.tsx             # Entry point
```

**SnapTest.tsx contains:**

- TestIdFinder (element tracking & recording)
- NetworkInterceptor (network recording)
- TestGenerator (test generation UI)
- All test generation logic (MSW handlers, test code)

### 🎮 User Interface

**Recording Controls:**

- Event recording panel (top-left)
- Network recording panel (top-center)
- Test generator panel (bottom-right)

**Real-time Feedback:**

- Live event history (top-right)
- Network activity log (bottom overlay)
- Element info tooltip (bottom-right)

### 🧪 Test Generation Features

**Generated Tests Include:**

- Component rendering with proper imports
- **@testing-library/user-event** setup and imports
- Sequential click events with `fireEvent.click()`
- **Keyboard interactions** with `await user.keyboard()` for realistic user input
- Text content assertions with `toHaveTextContent()`
- Network mocking with MSW v1 `rest.method()` handlers
- Async waiting with `waitFor()` and `findByTestId()`
- Proper MSW setup/teardown in describe blocks

**MSW v1 Compatibility:**

- Uses `rest.get/post/etc()` instead of `http.method()`
- Proper `(req, res, ctx)` handler signature
- `res(ctx.status(), ctx.json())` response format

### 🎯 Recording Workflow

1. **Start Recording**: Click "Start Recording" in event panel
2. **Interact**: 
   - Click elements to record interactions
   - Type in input fields and use keyboard shortcuts
   - Press Enter, Tab, arrow keys, Ctrl+A, etc.
3. **Assert**: Ctrl+Click elements to record text assertions
4. **Network**: Toggle network recording to capture API calls
5. **Generate**: Configure test name/component and generate test code
6. **Export**: Copy or download generated test and MSW handlers

### 🚀 Demo Application

**MockUserApp** demonstrates:

- User profile fetching from JSONPlaceholder API
- **Keyboard input testing** with search fields and text areas
- **Disappearing dropdown** component for testing edge cases
- Dynamic content loading with loading states
- State-aware test IDs (`random-user-button-ready` vs `loading`)
- Expandable post lists with individual test IDs
- Error handling and retry functionality

### Technology Stack

- **React 18 + TypeScript** - UI framework with type safety
- **Vite** - Build tool and dev server
- **Deno** - JavaScript runtime (instead of Node.js)
- **MSW v1** - Network request mocking (compatible with generated tests)
- **@testing-library/user-event** - Realistic user interaction simulation
- **JSONPlaceholder** - Mock API for demo data
- **React Testing Library** - Generated test framework

## Running the Project

```bash
deno task dev  # Start development server
```

SnapTest will show:

- User data fetching demo
- Real-time test ID highlighting on hover
- Network request recording controls
- Live network activity log

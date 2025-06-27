# Integration Test Framework - Project State

## Overview
This project is a React app built with Vite and Deno that serves as a foundation for developing an integration test framework. The framework records user interactions and network requests to automatically generate React Testing Library tests with MSW mocks.

## Current Implementation

### Core Components

1. **TestIdFinder** (`src/TestIdFinder.jsx`)
   - Tracks mouse movement and highlights elements with `data-test-id` attributes
   - Shows tooltip with test ID and element text content
   - Provides visual feedback for test-friendly elements

2. **NetworkInterceptor** (`src/NetworkInterceptor.jsx`)
   - Uses MSW (Mock Service Worker) to intercept all network requests
   - Records request/response pairs with timestamps
   - Provides recording controls (start/stop/clear)
   - Shows real-time network activity log

3. **PokemonData** (`src/PokemonData.jsx`)
   - Demo component that fetches user data from JSONPlaceholder API
   - Displays user profiles and posts with extensive test IDs
   - Uses state-aware test IDs (e.g., `random-user-button-ready` vs `random-user-button-loading`)

### Test-Friendly Features

- **State-aware test IDs**: Test IDs change based on element state (loading, ready, error)
- **Comprehensive test coverage**: Every interactive element has a `data-test-id`
- **Text content display**: TestIdFinder shows both test ID and element text
- **Network request logging**: All API calls are tracked with timing information

### Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Deno** - JavaScript runtime (instead of Node.js)
- **MSW 2.0** - Network request interception
- **JSONPlaceholder** - Mock API for demo data

## Project Structure

```
src/
├── App.jsx              # Main app component (minimal, just renders PokemonData)
├── main.jsx             # App entry point with providers
├── TestIdFinder.jsx     # Mouse tracking and test ID highlighting
├── NetworkInterceptor.jsx # Network request recording
├── PokemonData.jsx      # Demo component with API calls
└── mocks/
    ├── browser.js       # MSW worker setup
    └── handlers.js      # MSW request handlers (currently empty)
```

## Integration Test Framework Vision

The end goal is a framework that:

1. **Records interactions**: Captures click events on elements with test IDs
2. **Records network state**: Tracks API requests/responses with timing
3. **Maintains temporal order**: Associates network responses with user actions
4. **Generates tests**: Creates React Testing Library tests with MSW mocks
5. **Handles state changes**: Accounts for different API responses based on interaction sequence

### Example workflow:
```javascript
// User clicks "Select Random User" → API returns user data
// User clicks again → Same API returns different user data
// Framework generates test that mocks both responses in correct order
```

## Next Steps

1. **Click Recording**: Add click event capture to TestIdFinder
2. **Event Correlation**: Link click events with subsequent network requests
3. **Test Generation**: Create React Testing Library test code generator
4. **MSW Mock Generation**: Auto-generate MSW handlers from recorded responses
5. **Sequence Logic**: Implement conditional mocking based on interaction order

## Running the Project

```bash
deno task dev  # Start development server
```

The app will show:
- User data fetching demo
- Real-time test ID highlighting on hover
- Network request recording controls
- Live network activity log
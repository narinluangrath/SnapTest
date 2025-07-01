import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from 'react';

// Extend XMLHttpRequest type to include our custom properties
declare global {
  interface XMLHttpRequest {
    _snapTestRequestId?: string;
    _snapTestMethod?: string;
    _snapTestUrl?: string;
    _snapTestHeaders?: Record<string, string>;
  }
}

// Test Generation Logic (from testGenerator.ts)
interface TestOptions {
  testName?: string;
  componentName?: string;
  describe?: string;
  error?: string;
  status?: number;
}

interface GeneratedTest {
  testCode: string;
  mswHandlers: string;
  combinedEvents: CombinedEvent[];
}

interface CombinedEvent {
  id: string | number;
  timestamp: number;
  testId: string;
  elementText: string;
  tagName: string;
  elementType?: string | null;
  position?: {
    x: number;
    y: number;
  };
  clickPosition?: {
    x: number;
    y: number;
  };
  type:
    | 'click'
    | 'assertion'
    | 'keyboard'
    | 'network-request'
    | 'network-response'
    | 'network-error';
  method?: string;
  url?: string;
  request?: {
    body: string | null;
  };
  response?: {
    data: unknown;
  };
  status?: number;
  error?: string;
  // Keyboard-specific properties
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  keyboardSequence?: string;
}

interface TestSummary {
  totalEvents: number;
  totalNetworkCalls: number;
  uniqueTestIds: string[];
  uniqueEndpoints: string[];
}

interface GeneratedTestSuite extends GeneratedTest {
  summary: TestSummary;
}

function generateTest(
  eventHistory: EventHistoryItem[],
  networkHistory: NetworkHistoryItem[],
  options: TestOptions = {}
): GeneratedTest {
  const {
    testName = 'should handle user interactions correctly',
    componentName = 'MyComponent',
    describe = 'MyComponent Integration Tests',
  } = options;

  const combinedEvents: CombinedEvent[] = [
    ...eventHistory.map(
      (event): CombinedEvent => ({
        ...event,
        type: event.type,
        timestamp: new Date(event.timestamp).getTime(),
      })
    ),
    ...networkHistory.map(
      (event): CombinedEvent => ({
        id: event.id.toString(),
        testId: '',
        elementText: '',
        tagName: '',
        elementType: null,
        timestamp: event.timestamp,
        type: event.type as
          | 'network-request'
          | 'network-response'
          | 'network-error',
        method: event.method,
        url: event.url,
        request: event.request,
        response: event.response,
        status: event.status,
        error: event.error,
      })
    ),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const mswHandlers = generateMSWHandlers(networkHistory);
  const testCode = generateTestCode(combinedEvents, {
    testName,
    componentName,
    describe,
  });

  return {
    testCode,
    mswHandlers,
    combinedEvents,
  };
}

function generateMSWHandlers(networkHistory: NetworkHistoryItem[]): string {
  const defaultHandlers = new Map();

  networkHistory.forEach((event) => {
    if (event.type === 'network-response') {
      const method = event.method || 'GET';
      const url = new URL(event.url);
      const fullPath = url.pathname + url.search;
      const requestBody = event.request?.body || null;
      const key = `${method}-${fullPath}-${JSON.stringify(requestBody)}`;

      if (!defaultHandlers.has(key)) {
        defaultHandlers.set(key, {
          method: method.toLowerCase(),
          fullPath,
          requestBody,
          status: event.status,
          data: event.response?.data,
          headers: event.response?.headers || {},
        });
      }
    }
  });

  const handlers: string[] = [];
  defaultHandlers.forEach((handler) => {
    const hasBody =
      handler.requestBody !== null &&
      ['post', 'put', 'patch'].includes(handler.method);

    if (hasBody) {
      handlers.push(`
  rest.${handler.method}('*${handler.fullPath}', async (req, res, ctx) => {
    const body = await req.text()
    if (body === ${JSON.stringify(handler.requestBody)}) {
      return res(
        ctx.status(${handler.status}),
        ctx.json(${JSON.stringify(handler.data, null, 4)})
      )
    }
    return res(ctx.status(400), ctx.text('Request body mismatch'))
  })`);
    } else {
      handlers.push(`
  rest.${handler.method}('*${handler.fullPath}', (req, res, ctx) => {
    return res(
      ctx.status(${handler.status}),
      ctx.json(${JSON.stringify(handler.data, null, 4)})
    )
  })`);
    }
  });

  return `import { rest } from 'msw'

export const handlers = [${handlers.join(',')}\n]`;
}

interface NetworkState {
  clickEventId: string | null; // null for initial network events before any clicks
  networkEvents: CombinedEvent[];
  validUntil: number;
}

function correlateNetworkStates(
  combinedEvents: CombinedEvent[]
): NetworkState[] {
  const networkStates: NetworkState[] = [];
  let currentClick: CombinedEvent | null = null;
  let currentNetworkEvents: CombinedEvent[] = [];
  const initialNetworkEvents: CombinedEvent[] = [];

  // Find first click to determine initial network events
  const firstClickIndex = combinedEvents.findIndex(
    (event) => event.type === 'click'
  );

  for (let i = 0; i < combinedEvents.length; i++) {
    const event = combinedEvents[i];

    if (event.type === 'click') {
      // Finish previous network state if exists
      if (currentClick) {
        networkStates.push({
          clickEventId: currentClick.id.toString(),
          networkEvents: [...currentNetworkEvents],
          validUntil: event.timestamp,
        });
      }

      // Start new network state
      currentClick = event;
      currentNetworkEvents = [];
    } else if (event.type === 'network-response') {
      if (firstClickIndex === -1 || i < firstClickIndex) {
        // Network event happens before any clicks - add to initial events
        initialNetworkEvents.push(event);
      } else if (currentClick) {
        // Associate this network event with the current click
        currentNetworkEvents.push(event);
      }
    }
  }

  // Add initial network state if there are network events before first click
  if (initialNetworkEvents.length > 0) {
    networkStates.unshift({
      clickEventId: null, // null indicates initial network events
      networkEvents: initialNetworkEvents,
      validUntil:
        firstClickIndex !== -1
          ? combinedEvents[firstClickIndex].timestamp
          : Infinity,
    });
  }

  // Handle final network state (no next click to invalidate it)
  if (currentClick) {
    networkStates.push({
      clickEventId: currentClick.id.toString(),
      networkEvents: [...currentNetworkEvents],
      validUntil: Infinity,
    });
  }

  return networkStates;
}

function generateTestCode(
  combinedEvents: CombinedEvent[],
  { testName, componentName, describe }: Required<TestOptions>
): string {
  const imports = [
    "import { render, screen, fireEvent, waitFor } from '@testing-library/react'",
    "import userEvent from '@testing-library/user-event'",
    "import { rest } from 'msw'",
    "import { server } from '../mocks/server'",
    `import ${componentName} from './${componentName}'`,
  ];

  const networkStates = correlateNetworkStates(combinedEvents);
  const testSteps: string[] = [];
  let stepNumber = 1;

  // Add initial setup steps
  testSteps.push(`    // Setup user event
    const user = userEvent.setup()
    
    // Render component
    render(<${componentName} />)`);

  // Handle initial network events (before any clicks)
  const initialNetworkState = networkStates.find(
    (state) => state.clickEventId === null
  );
  if (initialNetworkState && initialNetworkState.networkEvents.length > 0) {
    testSteps.push(`
    // Step ${stepNumber}: Setup initial network state
    server.use(`);

    initialNetworkState.networkEvents.forEach((networkEvent, index) => {
      const method = (networkEvent.method || 'GET').toLowerCase();
      const url = new URL(networkEvent.url!);
      const fullPath = url.pathname + url.search;
      const requestBody = networkEvent.request?.body || null;
      const hasBody =
        requestBody !== null && ['post', 'put', 'patch'].includes(method);

      if (hasBody) {
        testSteps.push(`      rest.${method}('*${fullPath}', async (req, res, ctx) => {
        const body = await req.text()
        if (body === ${JSON.stringify(requestBody)}) {
          return res(
            ctx.status(${networkEvent.status}),
            ctx.json(${JSON.stringify(networkEvent.response?.data, null, 8)})
          )
        }
        return res(ctx.status(400), ctx.text('Request body mismatch'))
      })${index < initialNetworkState.networkEvents.length - 1 ? ',' : ''}`);
      } else {
        testSteps.push(`      rest.${method}('*${fullPath}', (req, res, ctx) => {
        return res(
          ctx.status(${networkEvent.status}),
          ctx.json(${JSON.stringify(networkEvent.response?.data, null, 8)})
        )
      })${index < initialNetworkState.networkEvents.length - 1 ? ',' : ''}`);
      }
    });

    testSteps.push(`    )`);
    stepNumber++;
  }

  for (const event of combinedEvents) {
    if (event.type === 'click') {
      // FIRST: Setup mocks for network state that this click will trigger
      const associatedNetworkState = networkStates.find(
        (state) => state.clickEventId === event.id.toString()
      );

      if (
        associatedNetworkState &&
        associatedNetworkState.networkEvents.length > 0
      ) {
        testSteps.push(`
    // Step ${stepNumber}: Setup network state BEFORE ${event.testId} click`);

        associatedNetworkState.networkEvents.forEach((networkEvent) => {
          const method = (networkEvent.method || 'GET').toLowerCase();
          const url = new URL(networkEvent.url!);
          const fullPath = url.pathname + url.search;
          const requestBody = networkEvent.request?.body || null;
          const hasBody =
            requestBody !== null && ['post', 'put', 'patch'].includes(method);

          if (hasBody) {
            testSteps.push(`    server.use(
      rest.${method}('*${fullPath}', async (req, res, ctx) => {
        const body = await req.text()
        if (body === ${JSON.stringify(requestBody)}) {
          return res(
            ctx.status(${networkEvent.status}),
            ctx.json(${JSON.stringify(networkEvent.response?.data, null, 6)})
          )
        }
        return res(ctx.status(400), ctx.text('Request body mismatch'))
      })
    )`);
          } else {
            testSteps.push(`    server.use(
      rest.${method}('*${fullPath}', (req, res, ctx) => {
        return res(
          ctx.status(${networkEvent.status}),
          ctx.json(${JSON.stringify(networkEvent.response?.data, null, 6)})
        )
      })
    )`);
          }
        });
        stepNumber++;
      }

      // SECOND: Now perform the click that will trigger the mocked network calls
      testSteps.push(`
    // Step ${stepNumber}: Click ${event.testId}
    fireEvent.click(await screen.findByTestId('${event.testId}'))`);
      stepNumber++;
    } else if (event.type === 'assertion') {
      testSteps.push(`
    // Step ${stepNumber}: Assert ${event.testId} text content
    expect(await screen.findByTestId('${
      event.testId
    }')).toHaveTextContent('${event.elementText.replace(/'/g, "\\'")}')`);
      stepNumber++;
    } else if (event.type === 'keyboard') {
      testSteps.push(`
    // Step ${stepNumber}: Keyboard input${event.testId !== 'document' ? ` on ${event.testId}` : ''}
    await user.keyboard('${event.keyboardSequence || event.key}')`);
      stepNumber++;
    }
  }

  const testCode = `${imports.join('\n')}

describe('${describe}', () => {
  beforeEach(() => {
    server.listen()
  })

  afterEach(() => {
    server.resetHandlers()
  })

  afterAll(() => {
    server.close()
  })

  test('${testName}', async () => {
${testSteps.join('\n')}
  })
})`;

  return testCode;
}

function _camelCase(str: string): string {
  return str
    .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
    .replace(/^[a-z]/, (match) => match.toLowerCase());
}

export function generateTestSuite(
  eventHistory: EventHistoryItem[],
  networkHistory: NetworkHistoryItem[],
  options: TestOptions = {}
): GeneratedTestSuite {
  const result = generateTest(eventHistory, networkHistory, options);

  return {
    ...result,
    summary: {
      totalEvents: eventHistory.length,
      totalNetworkCalls: networkHistory.filter(
        (e) => e.type === 'network-request'
      ).length,
      uniqueTestIds: [...new Set(eventHistory.map((e) => e.testId))],
      uniqueEndpoints: [
        ...new Set(
          networkHistory
            .filter((e) => e.type === 'network-request')
            .map((e) => e.url)
        ),
      ],
    },
  };
}

// Combined SnapTestProvider Logic
interface SnapTestProviderProps {
  children: React.ReactNode;
}

interface RecordedEvent {
  id: number;
  timestamp: string;
  testId: string;
  elementText: string;
  tagName: string;
  elementType?: string | null;
  type: 'click' | 'assertion' | 'keyboard';
  position: {
    x: number;
    y: number;
  };
  clickPosition: {
    x: number;
    y: number;
  };
  // Keyboard-specific properties
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  keyboardSequence?: string; // user-event formatted string
}

interface SnapTestContextType {
  networkEvents: NetworkHistoryItem[];
  isNetworkRecording: boolean;
  startNetworkRecording: () => void;
  stopNetworkRecording: () => void;
  clearNetworkEvents: () => void;
  recordedEvents: RecordedEvent[];
  isEventRecording: boolean;
  startEventRecording: () => void;
  stopEventRecording: () => void;
  clearEvents: () => void;
  isConsoleLogging: boolean;
  toggleConsoleLogging: () => void;
}

const SnapTestContext = createContext<SnapTestContextType | null>(null);

export const useSnapTest = () => {
  const context = useContext(SnapTestContext);
  if (!context) {
    throw new Error('useSnapTest must be used within a SnapTestProvider');
  }
  return context;
};

function SnapTestProvider({ children }: SnapTestProviderProps) {
  // Platform detection for modifier keys
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Fallback UUID generator for environments where crypto.randomUUID is not available
  const generateUUID = useCallback(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback UUID generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16);
      const v = c === 'x' ? r : (r % 4) + 8;
      return v.toString(16);
    });
  }, []);

  // Inject global styles to ensure SnapTest UI always stays on top
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.id = 'snaptest-override-styles';
    styleElement.textContent = `
      /* Ensure SnapTest UI elements always stay on top */
      .snaptest-ui {
        z-index: 2147483647 !important;
        position: fixed !important;
        pointer-events: auto !important;
      }

      /* Minimal protection - only override what's necessary for positioning and visibility */
      .snaptest-ui {
        box-sizing: border-box !important;
      }
    `;

    if (!document.getElementById('snaptest-override-styles')) {
      document.head.appendChild(styleElement);
    }

    return () => {
      const existingStyle = document.getElementById('snaptest-override-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // Network recording state
  const [networkEvents, setNetworkEvents] = useState<NetworkHistoryItem[]>([]);
  const [isNetworkRecording, setIsNetworkRecording] = useState(false);

  // Event recording state
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(
    null
  );
  const [recordedEvents, setRecordedEvents] = useState<RecordedEvent[]>([]);
  const [isEventRecording, setIsEventRecording] = useState(false);
  const [_assertionHighlight, setAssertionHighlight] = useState<Element | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Console logging state (enabled by default)
  const [isConsoleLogging, setIsConsoleLogging] = useState(true);

  // Track all potential event targets (including portals and modals)
  const eventTargetsRef = useRef<Set<Element>>(new Set());
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const originalStopPropagationRef = useRef<(() => void) | null>(null);
  const originalStopImmediatePropagationRef = useRef<(() => void) | null>(null);

  // Cache element info to handle disappearing elements (dropdowns, modals)
  const hoveredElementInfoRef = useRef<{
    element: Element;
    testId: string;
    elementText: string;
    tagName: string;
    elementType: string | null;
    rect: DOMRect;
    timestamp: number;
  } | null>(null);

  const findClosestTestId = (element: Element): Element | null => {
    let current: Element | null = element;
    while (current && current !== document.body) {
      if (current.getAttribute && current.getAttribute('data-test-id')) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  // Map browser keyboard events to user-event keyboard format
  const mapKeyToUserEvent = (event: KeyboardEvent): string => {
    const { key, ctrlKey, shiftKey, altKey, metaKey } = event;
    
    // Handle special keys
    const specialKeyMap: Record<string, string> = {
      'Enter': '{Enter}',
      'Escape': '{Escape}',
      'Tab': '{Tab}',
      'Backspace': '{Backspace}',
      'Delete': '{Delete}',
      'ArrowUp': '{ArrowUp}',
      'ArrowDown': '{ArrowDown}',
      'ArrowLeft': '{ArrowLeft}',
      'ArrowRight': '{ArrowRight}',
      'Home': '{Home}',
      'End': '{End}',
      'PageUp': '{PageUp}',
      'PageDown': '{PageDown}',
      ' ': '{Space}',
    };

    let keySequence = '';
    
    // Handle modifier combinations
    if (ctrlKey || metaKey) {
      const modifier = metaKey ? 'Meta' : 'Control';
      if (specialKeyMap[key]) {
        keySequence = `{${modifier}>}${specialKeyMap[key]}{/${modifier}}`;
      } else if (key.length === 1) {
        keySequence = `{${modifier}>}${key.toLowerCase()}{/${modifier}}`;
      }
    } else if (shiftKey && key.length === 1 && key.match(/[a-zA-Z]/)) {
      // Shift + letter (uppercase)
      keySequence = key.toUpperCase();
    } else if (altKey) {
      const altKey = key.length === 1 ? key.toLowerCase() : (specialKeyMap[key] || key);
      keySequence = `{Alt>}${altKey}{/Alt}`;
    } else if (specialKeyMap[key]) {
      keySequence = specialKeyMap[key];
    } else if (key.length === 1) {
      // Regular character
      keySequence = key;
    }
    
    return keySequence;
  };

  const isWithinFrameworkUI = (element: Element): boolean => {
    let current: Element | null = element;
    while (current && current !== document.body) {
      if (current.classList && current.classList.contains('snaptest-ui')) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  };

  // Simplified event target detection - just use document to capture all events
  const detectEventTargets = useCallback(() => {
    const targets = new Set<Element>();
    // Only use document to capture all events with event delegation
    targets.add(document.documentElement);
    eventTargetsRef.current = targets;
  }, []);

  // Aggressive event handling - override stopPropagation during recording
  const overrideEventPropagation = useCallback(() => {
    if (!isEventRecording) return;

    // Store original methods
    originalStopPropagationRef.current = Event.prototype.stopPropagation;
    originalStopImmediatePropagationRef.current =
      Event.prototype.stopImmediatePropagation;

    // Override stopPropagation to allow our listeners to still work
    Event.prototype.stopPropagation = function (this: Event) {
      // Mark that propagation was stopped, but don't actually stop it during our recording
      (this as any)._snapTestPropagationStopped = true;

      // Still call original for other listeners, but after a small delay
      // This ensures our listeners fire first
      setTimeout(() => {
        if (originalStopPropagationRef.current) {
          originalStopPropagationRef.current.call(this);
        }
      }, 0);
    };

    Event.prototype.stopImmediatePropagation = function (this: Event) {
      (this as any)._snapTestImmediatePropagationStopped = true;

      setTimeout(() => {
        if (originalStopImmediatePropagationRef.current) {
          originalStopImmediatePropagationRef.current.call(this);
        }
      }, 0);
    };
  }, [isEventRecording]);

  const restoreEventPropagation = useCallback(() => {
    if (originalStopPropagationRef.current) {
      Event.prototype.stopPropagation = originalStopPropagationRef.current;
      originalStopPropagationRef.current = null;
    }
    if (originalStopImmediatePropagationRef.current) {
      Event.prototype.stopImmediatePropagation =
        originalStopImmediatePropagationRef.current;
      originalStopImmediatePropagationRef.current = null;
    }
  }, []);

  const handleMouseMove = useCallback(
    (event: Event) => {
      console.log('handleMouseMove', event);
      const mouseEvent = event as MouseEvent;
      const target = mouseEvent.target as Element;

      // Ignore hovers within framework UI panels
      if (isWithinFrameworkUI(target)) {
        // Clear any existing highlight when entering framework UI
        if (highlightedElement) {
          (highlightedElement as HTMLElement).style.outline = '';
          (highlightedElement as HTMLElement).style.outlineOffset = '';
          setHighlightedElement(null);
        }
        hoveredElementInfoRef.current = null;
        return;
      }

      const elementWithTestId = findClosestTestId(target);

      if (elementWithTestId !== highlightedElement) {
        if (highlightedElement) {
          (highlightedElement as HTMLElement).style.outline = '';
          (highlightedElement as HTMLElement).style.outlineOffset = '';
        }

        if (elementWithTestId) {
          (elementWithTestId as HTMLElement).style.outline = '2px solid red';
          (elementWithTestId as HTMLElement).style.outlineOffset = '2px';

          // Cache element info for potential click later (especially important for disappearing elements)
          const testId = elementWithTestId.getAttribute('data-test-id') || '';
          const elementText =
            (elementWithTestId as HTMLElement).innerText?.trim() || '';
          const tagName = elementWithTestId.tagName.toLowerCase();
          const elementType =
            (elementWithTestId as HTMLInputElement).type || null;
          const rect = elementWithTestId.getBoundingClientRect();

          hoveredElementInfoRef.current = {
            element: elementWithTestId,
            testId,
            elementText,
            tagName,
            elementType,
            rect,
            timestamp: Date.now(),
          };
        } else {
          hoveredElementInfoRef.current = null;
        }

        setHighlightedElement(elementWithTestId);
      }
    },
    [highlightedElement]
  );

  // Multi-type event handler for maximum capture reliability
  const handleInteraction = useCallback(
    (event: Event) => {
      console.log('handleInteraction', event.type, event);
      if (!isEventRecording) return;

      const mouseEvent = event as MouseEvent;
      const target = mouseEvent.target as Element;

      // Ignore clicks within framework UI panels
      if (isWithinFrameworkUI(target)) {
        return;
      }

      // For mousedown, we want to capture and cache the element info
      // For click, we want to actually record the event
      let elementToRecord: Element | null = null;
      const cachedInfo = hoveredElementInfoRef.current;

      if (event.type === 'mousedown') {
        // On mousedown, try to find and cache the element (before it potentially disappears)
        elementToRecord = findClosestTestId(target);
        if (elementToRecord) {
          const testId = elementToRecord.getAttribute('data-test-id') || '';
          const elementText =
            (elementToRecord as HTMLElement).innerText?.trim() || '';
          const tagName = elementToRecord.tagName.toLowerCase();
          const elementType =
            (elementToRecord as HTMLInputElement).type || null;
          const rect = elementToRecord.getBoundingClientRect();

          hoveredElementInfoRef.current = {
            element: elementToRecord,
            testId,
            elementText,
            tagName,
            elementType,
            rect,
            timestamp: Date.now(),
          };

        }
        return; // Don't record on mousedown, just cache
      }

      // For click events, try current element first, then fall back to cached info
      if (event.type === 'click') {
        elementToRecord = findClosestTestId(target);

        // If we can't find the element (it disappeared), use cached info if it's recent
        if (
          !elementToRecord &&
          cachedInfo &&
          Date.now() - cachedInfo.timestamp < 2000
        ) {
          // Use cached element info from hover/mousedown
          console.log(
            'Using cached element info for disappeared element:',
            cachedInfo.testId
          );

          const timestamp = new Date().toISOString();

          if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
            mouseEvent.stopPropagation();
            mouseEvent.preventDefault();

            const eventData: RecordedEvent = {
              id: Date.now() + Math.random(),
              timestamp,
              testId: cachedInfo.testId,
              elementText: cachedInfo.elementText,
              tagName: cachedInfo.tagName,
              elementType: cachedInfo.elementType,
              type: 'assertion' as const,
              position: {
                x: cachedInfo.rect.left + cachedInfo.rect.width / 2,
                y: cachedInfo.rect.top + cachedInfo.rect.height / 2,
              },
              clickPosition: {
                x: mouseEvent.clientX,
                y: mouseEvent.clientY,
              },
            };

            setRecordedEvents((prev) => [...prev, eventData]);
            return;
          }

          const eventData: RecordedEvent = {
            id: Date.now() + Math.random(),
            timestamp,
            testId: cachedInfo.testId,
            elementText: cachedInfo.elementText,
            tagName: cachedInfo.tagName,
            elementType: cachedInfo.elementType,
            type: 'click' as const,
            position: {
              x: cachedInfo.rect.left + cachedInfo.rect.width / 2,
              y: cachedInfo.rect.top + cachedInfo.rect.height / 2,
            },
            clickPosition: {
              x: mouseEvent.clientX,
              y: mouseEvent.clientY,
            },
          };

          setRecordedEvents((prev) => [...prev, eventData]);
          return;
        }

        // Normal path: element still exists
        if (elementToRecord) {
          const testId = elementToRecord.getAttribute('data-test-id');
          const timestamp = new Date().toISOString();
          const elementText =
            (elementToRecord as HTMLElement).innerText?.trim() || '';
          const tagName = elementToRecord.tagName.toLowerCase();
          const elementType =
            (elementToRecord as HTMLInputElement).type || null;
          const rect = elementToRecord.getBoundingClientRect();

          if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
            mouseEvent.stopPropagation();
            mouseEvent.preventDefault();

            setAssertionHighlight(elementToRecord);
            (elementToRecord as HTMLElement).style.outline = '3px solid orange';
            (elementToRecord as HTMLElement).style.outlineOffset = '3px';

            setTimeout(() => {
              (elementToRecord as HTMLElement).style.outline = '';
              (elementToRecord as HTMLElement).style.outlineOffset = '';
              setAssertionHighlight(null);
            }, 1000);

            const eventData: RecordedEvent = {
              id: Date.now() + Math.random(),
              timestamp,
              testId: testId || '',
              elementText,
              tagName,
              elementType,
              type: 'assertion' as const,
              position: {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              },
              clickPosition: {
                x: mouseEvent.clientX,
                y: mouseEvent.clientY,
              },
            };

            setRecordedEvents((prev) => [...prev, eventData]);
            return;
          }

          const eventData: RecordedEvent = {
            id: Date.now() + Math.random(),
            timestamp,
            testId: testId || '',
            elementText,
            tagName,
            elementType,
            type: 'click' as const,
            position: {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            },
            clickPosition: {
              x: mouseEvent.clientX,
              y: mouseEvent.clientY,
            },
          };

          setRecordedEvents((prev) => [...prev, eventData]);
        }
      }
    },
    [isEventRecording]
  );

  // Keyboard event handler
  const handleKeyboard = useCallback(
    (event: Event) => {
      console.log('handleKeyboard', event.type, event);
      if (!isEventRecording) return;

      const keyboardEvent = event as KeyboardEvent;
      const target = keyboardEvent.target as Element;

      // Ignore keyboard events within framework UI panels
      if (isWithinFrameworkUI(target)) {
        return;
      }

      // Skip modifier-only keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(keyboardEvent.key)) {
        return;
      }

      const keySequence = mapKeyToUserEvent(keyboardEvent);
      if (!keySequence) return;

      const timestamp = new Date().toISOString();
      const targetWithTestId = findClosestTestId(target);
      
      // Use target element info if available, otherwise use document
      const testId = targetWithTestId?.getAttribute('data-test-id') || 'document';
      const elementText = targetWithTestId ? 
        (targetWithTestId as HTMLElement).innerText?.trim() || '' : '';
      const tagName = targetWithTestId?.tagName.toLowerCase() || 'document';
      const elementType = targetWithTestId ? 
        (targetWithTestId as HTMLInputElement).type || null : null;

      const eventData: RecordedEvent = {
        id: Date.now() + Math.random(),
        timestamp,
        testId,
        elementText,
        tagName,
        elementType,
        type: 'keyboard' as const,
        position: { x: 0, y: 0 }, // Not applicable for keyboard
        clickPosition: { x: 0, y: 0 }, // Not applicable for keyboard
        key: keyboardEvent.key,
        code: keyboardEvent.code,
        ctrlKey: keyboardEvent.ctrlKey,
        shiftKey: keyboardEvent.shiftKey,
        altKey: keyboardEvent.altKey,
        metaKey: keyboardEvent.metaKey,
        keyboardSequence: keySequence,
      };

      setRecordedEvents((prev) => [...prev, eventData]);
    },
    [isEventRecording, mapKeyToUserEvent, findClosestTestId, isWithinFrameworkUI]
  );

  const startEventRecording = () => setIsEventRecording(true);
  const stopEventRecording = () => setIsEventRecording(false);
  const clearEvents = () => setRecordedEvents([]);

  const startNetworkRecording = () => {
    setNetworkEvents([]);
    setIsNetworkRecording(true);
  };
  const stopNetworkRecording = () => setIsNetworkRecording(false);
  const clearNetworkEvents = () => setNetworkEvents([]);

  const toggleConsoleLogging = () => setIsConsoleLogging((prev) => !prev);

  // Network interception effect
  useEffect(() => {
    if (!isNetworkRecording) return;

    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const requestId = generateUUID();
      const [resource, config] = args;

      const url =
        typeof resource === 'string'
          ? resource
          : (resource as Request).url || '';
      const method = config?.method || 'GET';

      const requestEvent: NetworkHistoryItem = {
        id: requestId,
        type: 'network-request',
        method,
        url,
        timestamp: Date.now(),
        request: {
          body: (config?.body as string) || null,
        },
      };

      setNetworkEvents((prev) => [...prev, requestEvent]);

      // Console logging for request
      if (isConsoleLogging) {
        console.group(`🌐 SnapTest Network Request (fetch)`);
        console.log(`Method: ${method}`);
        console.log(`URL: ${url}`);
        if (requestEvent.request?.body)
          console.log(`Body: ${requestEvent.request.body}`);
        console.log(`Request ID: ${requestId}`);
        console.log(
          `Timestamp: ${new Date(requestEvent.timestamp).toISOString()}`
        );
        console.groupEnd();
      }

      try {
        const response = await originalFetch(...args);
        const responseClone = response.clone();

        try {
          const responseText = await responseClone.text();
          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch {
            responseData = responseText;
          }

          const responseEvent: NetworkHistoryItem = {
            id: requestId,
            type: 'network-response',
            status: response.status,
            url,
            timestamp: Date.now(),
            response: {
              data: responseData,
            },
          };

          setNetworkEvents((prev) => [...prev, responseEvent]);

          // Console logging for response
          if (isConsoleLogging) {
            console.group(`📡 SnapTest Network Response (fetch)`);
            console.log(`Status: ${response.status} ${response.statusText}`);
            console.log(`URL: ${url}`);
            console.log(`Response Data:`, responseData);
            console.log(`Request ID: ${requestId}`);
            console.log(
              `Timestamp: ${new Date(responseEvent.timestamp).toISOString()}`
            );
            console.groupEnd();
          }
        } catch (error: unknown) {
          // ignore
        }

        return response;
      } catch (error) {
        const errorEvent: NetworkHistoryItem = {
          id: requestId,
          type: 'network-error',
          url,
          timestamp: Date.now(),
          error: (error as Error).message,
        };

        setNetworkEvents((prev) => [...prev, errorEvent]);

        // Console logging for error
        if (isConsoleLogging) {
          console.group(`❌ SnapTest Network Error (fetch)`);
          console.error(`Error: ${(error as Error).message}`);
          console.log(`URL: ${url}`);
          console.log(`Request ID: ${requestId}`);
          console.log(
            `Timestamp: ${new Date(errorEvent.timestamp).toISOString()}`
          );
          console.groupEnd();
        }

        throw error;
      }
    };

    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalXHRSetRequestHeader =
      XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      this._snapTestRequestId = generateUUID();
      this._snapTestMethod = method;
      this._snapTestUrl = url.toString();
      this._snapTestHeaders = {};

      return originalXHROpen.call(
        this,
        method,
        url,
        async ?? true,
        username,
        password
      );
    };

    XMLHttpRequest.prototype.setRequestHeader = function (
      name: string,
      value: string
    ) {
      if (!this._snapTestHeaders) {
        this._snapTestHeaders = {};
      }
      this._snapTestHeaders[name] = value;
      return originalXHRSetRequestHeader.call(this, name, value);
    };

    XMLHttpRequest.prototype.send = function (
      body?: Document | XMLHttpRequestBodyInit | null
    ) {
      const requestId = this._snapTestRequestId;
      const method = this._snapTestMethod;
      const url = this._snapTestUrl;

      if (requestId && method && url) {
        const requestEvent: NetworkHistoryItem = {
          id: requestId,
          type: 'network-request',
          method,
          url,
          timestamp: Date.now(),
          request: {
            body: body ? body.toString() : null,
          },
        };

        setNetworkEvents((prev) => [...prev, requestEvent]);

        // Console logging for XHR request
        if (isConsoleLogging) {
          console.group(`🌐 SnapTest Network Request (XHR)`);
          console.log(`Method: ${method}`);
          console.log(`URL: ${url}`);
          if (requestEvent.request?.body)
            console.log(`Body: ${requestEvent.request.body}`);
          console.log(`Request ID: ${requestId}`);
          console.log(
            `Timestamp: ${new Date(requestEvent.timestamp).toISOString()}`
          );
          console.groupEnd();
        }

        this.addEventListener('load', () => {
          let responseData;
          try {
            responseData = JSON.parse(this.responseText);
          } catch {
            responseData = this.responseText;
          }

          const responseEvent: NetworkHistoryItem = {
            id: requestId,
            type: 'network-response',
            status: this.status,
            url,
            timestamp: Date.now(),
            response: {
              data: responseData,
            },
          };

          setNetworkEvents((prev) => [...prev, responseEvent]);

          // Console logging for XHR response
          if (isConsoleLogging) {
            console.group(`📡 SnapTest Network Response (XHR)`);
            console.log(`Status: ${this.status} ${this.statusText}`);
            console.log(`URL: ${url}`);
            console.log(`Response Data:`, responseData);
            console.log(`Request ID: ${requestId}`);
            console.log(
              `Timestamp: ${new Date(responseEvent.timestamp).toISOString()}`
            );
            console.groupEnd();
          }
        });

        this.addEventListener('error', () => {
          const errorEvent: NetworkHistoryItem = {
            id: requestId,
            type: 'network-error',
            url,
            timestamp: Date.now(),
            error: this.statusText || 'XMLHttpRequest error',
          };

          setNetworkEvents((prev) => [...prev, errorEvent]);

          // Console logging for XHR error
          if (isConsoleLogging) {
            console.group(`❌ SnapTest Network Error (XHR)`);
            console.error(
              `Error: ${this.statusText || 'XMLHttpRequest error'}`
            );
            console.log(`URL: ${url}`);
            console.log(`Request ID: ${requestId}`);
            console.log(
              `Timestamp: ${new Date(errorEvent.timestamp).toISOString()}`
            );
            console.groupEnd();
          }
        });
      }

      return originalXHRSend.call(this, body);
    };

    return () => {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXHROpen;
      XMLHttpRequest.prototype.send = originalXHRSend;
      XMLHttpRequest.prototype.setRequestHeader = originalXHRSetRequestHeader;
    };
  }, [isNetworkRecording, isConsoleLogging, generateUUID]);

  // Enhanced multi-level event capture with propagation override
  useEffect(() => {
    if (!isEventRecording) return;

    // Override event propagation methods
    overrideEventPropagation();

    // Initial detection of event targets
    detectEventTargets();

    // No need for mutation observer with simplified approach

    // Add event listeners for click detection
    const addEventListeners = () => {
      eventTargetsRef.current.forEach((target) => {
        // Mousemove for highlighting
        target.addEventListener('mousemove', handleMouseMove, {
          passive: true,
          capture: true,
        });

        // Only mousedown for caching element info before it disappears
        target.addEventListener('mousedown', handleInteraction, {
          capture: true,
          passive: false,
        });

        // Click for actual recording
        target.addEventListener('click', handleInteraction, {
          capture: true,
          passive: false, // Allow preventDefault for assertions
        });

        // Keyboard events for recording
        target.addEventListener('keydown', handleKeyboard, {
          capture: true,
          passive: false,
        });
      });
    };

    const removeEventListeners = () => {
      eventTargetsRef.current.forEach((target) => {
        target.removeEventListener('mousemove', handleMouseMove, true);
        target.removeEventListener('mousedown', handleInteraction, true);
        target.removeEventListener('click', handleInteraction, true);
        target.removeEventListener('keydown', handleKeyboard, true);
      });
    };

    addEventListeners();

    return () => {
      removeEventListeners();
      restoreEventPropagation();
      if (highlightedElement) {
        (highlightedElement as HTMLElement).style.outline = '';
        (highlightedElement as HTMLElement).style.outlineOffset = '';
      }
    };
  }, [
    isEventRecording,
    handleMouseMove,
    handleInteraction,
    handleKeyboard,
    highlightedElement,
    detectEventTargets,
    overrideEventPropagation,
    restoreEventPropagation,
  ]);

  const contextValue = {
    networkEvents,
    isNetworkRecording,
    startNetworkRecording,
    stopNetworkRecording,
    clearNetworkEvents,
    recordedEvents,
    isEventRecording,
    startEventRecording,
    stopEventRecording,
    clearEvents,
    isConsoleLogging,
    toggleConsoleLogging,
  };

  return (
    <SnapTestContext.Provider value={contextValue}>
      <div ref={containerRef} style={{ minHeight: '100vh' }}>
        {children}

        {/* Event Recording Panel */}
        <div
          className="snaptest-ui"
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 2147483647,
            minWidth: '200px',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            Event Recording (Global)
          </div>
          <div style={{ marginBottom: '8px', fontSize: '10px', opacity: 0.8 }}>
            Clicks: {recordedEvents.filter((e) => e.type === 'click').length} |
            Assertions:{' '}
            {recordedEvents.filter((e) => e.type === 'assertion').length} |
            Keyboard:{' '}
            {recordedEvents.filter((e) => e.type === 'keyboard').length}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <button
              onClick={
                isEventRecording ? stopEventRecording : startEventRecording
              }
              style={{
                background: isEventRecording ? '#ff4444' : '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '8px',
                fontSize: '11px',
              }}
            >
              {isEventRecording ? 'Stop' : 'Start'} Recording
            </button>
            <button
              onClick={clearEvents}
              style={{
                background: '#666',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Clear ({recordedEvents.length})
            </button>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <button
              onClick={toggleConsoleLogging}
              style={{
                background: isConsoleLogging ? '#4CAF50' : '#666',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                width: '100%',
              }}
            >
              Console Logging: {isConsoleLogging ? 'ON' : 'OFF'}
            </button>
          </div>
          {isEventRecording && (
            <div style={{ color: '#ff4444' }}>● Recording clicks...</div>
          )}
          {isEventRecording && (
            <div style={{ color: '#888', fontSize: '10px', marginTop: '4px' }}>
              {isMac ? 'Cmd+Click' : 'Ctrl+Click'} for assertions
            </div>
          )}
        </div>

        {/* Network Recording Panel */}
        <div
          className="snaptest-ui"
          style={{
            position: 'fixed',
            top: '10px',
            left: '250px',
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 2147483647,
            minWidth: '200px',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            Network Recording
          </div>
          <div style={{ marginBottom: '8px' }}>
            <button
              onClick={
                isNetworkRecording
                  ? stopNetworkRecording
                  : startNetworkRecording
              }
              style={{
                background: isNetworkRecording ? '#ff4444' : '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '8px',
                fontSize: '11px',
              }}
            >
              {isNetworkRecording ? 'Stop' : 'Start'} Recording
            </button>
            <button
              onClick={clearNetworkEvents}
              style={{
                background: '#666',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Clear ({networkEvents.length})
            </button>
          </div>
          {isNetworkRecording && (
            <div style={{ color: '#2196F3' }}>● Recording network...</div>
          )}
        </div>

        {recordedEvents.length > 0 && (
          <div
            className="snaptest-ui"
            style={{
              position: 'fixed',
              bottom: '10px',
              right: highlightedElement ? '320px' : '10px',
              left: '50%',
              background: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              zIndex: 2147483647,
              maxHeight: '200px',
              overflowY: 'auto',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              Recorded Events ({recordedEvents.length})
            </div>
            {recordedEvents.slice(-10).map((event) => (
              <div
                key={event.id}
                style={{
                  marginBottom: '8px',
                  padding: '6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  fontSize: '10px',
                }}
              >
                <div
                  style={{
                    color: event.type === 'assertion' ? '#FF9800' : 
                           event.type === 'keyboard' ? '#2196F3' : '#4CAF50',
                  }}
                >
                  {event.type === 'keyboard' ? '⌨️' : ''}{event.type}:{' '}
                  {event.type === 'keyboard' ? (event.keyboardSequence || event.key) : event.testId}
                </div>
                <div style={{ opacity: 0.8 }}>
                  time: {new Date(event.timestamp).toLocaleTimeString()}
                </div>
                <div style={{ opacity: 0.8 }}>
                  {event.type === 'keyboard' ? 'target' : 'element'}: {event.testId === 'document' ? 'document' : event.tagName}
                  {event.elementType ? `[${event.elementType}]` : ''}
                </div>
                {event.type === 'keyboard' && event.key && (
                  <div style={{ opacity: 0.8 }}>
                    key: "{event.key}" {event.ctrlKey || event.metaKey ? '+ modifier' : ''}
                  </div>
                )}
                {event.elementText && event.type !== 'keyboard' && (
                  <div style={{ opacity: 0.8 }}>
                    text: "
                    {event.elementText.length > 30
                      ? `${event.elementText.substring(0, 30)}...`
                      : event.elementText}
                    "
                  </div>
                )}
              </div>
            ))}
            {recordedEvents.length > 10 && (
              <div style={{ opacity: 0.6, textAlign: 'center' }}>
                ... showing last 10 events
              </div>
            )}
          </div>
        )}

        {highlightedElement && (
          <div
            className="snaptest-ui"
            style={{
              position: 'fixed',
              bottom: '10px',
              right: '10px',
              width: '300px',
              background: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'monospace',
              zIndex: 2147483647,
              pointerEvents: 'none',
              maxHeight: '200px',
              wordBreak: 'break-word',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                marginBottom: '4px',
                fontWeight: 'bold',
                color: '#ff6b6b',
              }}
            >
              Element Info
            </div>
            <div style={{ color: '#4CAF50' }}>
              data-test-id: {highlightedElement.getAttribute('data-test-id')}
            </div>
            {(() => {
              const text = (
                highlightedElement as HTMLElement
              ).innerText?.trim();
              if (text && text.length > 0) {
                const truncatedText =
                  text.length > 100 ? `${text.substring(0, 100)}...` : text;
                return (
                  <div style={{ marginTop: '4px', opacity: 0.8 }}>
                    text: "{truncatedText}"
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {networkEvents.length > 0 && (
          <div
            className="snaptest-ui"
            style={{
              position: 'fixed',
              bottom: '10px',
              left: '10px',
              right: recordedEvents.length > 0 ? '50%' : '10px',
              maxHeight: '200px',
              background: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              overflow: 'auto',
              zIndex: 2147483647,
              pointerEvents: 'auto',
            }}
          >
            <div>
              <strong>Network Events Log:</strong>
            </div>
            {networkEvents.map((event, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                {event.type === 'network-request' ? (
                  <span style={{ color: '#87CEEB' }}>
                    → {event.method} {event.url}
                  </span>
                ) : (
                  <span style={{ color: '#90EE90' }}>
                    ← {event.status} (Response)
                  </span>
                )}
                <span style={{ color: '#ddd', marginLeft: '10px' }}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}

        <SnapTestGenerator />
      </div>
    </SnapTestContext.Provider>
  );
}

interface NetworkHistoryItem {
  id: string;
  type: 'network-request' | 'network-response' | 'network-error';
  method?: string;
  url: string;
  timestamp: number;
  status?: number;
  request?: {
    body: string | null;
  };
  response?: {
    data: unknown;
    headers?: Record<string, unknown>;
  };
  error?: string;
}

interface EventHistoryItem {
  id: string | number;
  timestamp: string;
  testId: string;
  elementText: string;
  tagName: string;
  elementType?: string | null;
  type: 'click' | 'assertion' | 'keyboard';
  // Keyboard-specific properties
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  keyboardSequence?: string;
}

interface GeneratedTestSuite {
  testCode: string;
  mswHandlers: string;
  summary: {
    totalEvents: number;
    totalNetworkCalls: number;
    uniqueTestIds: string[];
    uniqueEndpoints: string[];
  };
}

function SnapTestGenerator() {
  const { recordedEvents: eventHistory, networkEvents: networkHistory } =
    useSnapTest();
  const [generatedTest, setGeneratedTest] = useState<GeneratedTestSuite | null>(
    null
  );
  const [showOutput, setShowOutput] = useState(false);
  const [testOptions, setTestOptions] = useState({
    testName: 'should handle user interactions correctly',
    componentName: 'MyComponent',
    describe: 'MyComponent Integration Tests',
  });

  const handleGenerateTest = () => {
    if (eventHistory.length === 0 && networkHistory.length === 0) {
      console.warn(
        'SnapTest: No events or network activity recorded. Start recording and interact with the app first.'
      );
      return;
    }

    const result = generateTestSuite(eventHistory, networkHistory, testOptions);
    setGeneratedTest(result);
    setShowOutput(true);
  };

  const copyToClipboard = (text: string, type: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          console.log(`SnapTest: ${type} copied to clipboard!`);
        })
        .catch(() => {
          console.error('SnapTest: Failed to copy to clipboard');
        });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        console.log(`SnapTest: ${type} copied to clipboard!`);
      } catch (err) {
        console.error('SnapTest: Failed to copy to clipboard');
      }
      document.body.removeChild(textArea);
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="snaptest-ui"
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 2147483647,
        pointerEvents: 'auto',
        minWidth: '200px',
        maxWidth: showOutput ? '600px' : '200px',
        maxHeight: showOutput ? '80vh' : 'auto',
        overflowY: 'auto',
      }}
    >
      <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
        SnapTest Generator
      </div>

      {!showOutput ? (
        <>
          <div style={{ marginBottom: '8px', fontSize: '10px', opacity: 0.8 }}>
            Clicks: {eventHistory.filter((e) => e.type === 'click').length} |
            Assertions:{' '}
            {eventHistory.filter((e) => e.type === 'assertion').length} |
            Keyboard:{' '}
            {eventHistory.filter((e) => e.type === 'keyboard').length} |
            Network:{' '}
            {networkHistory.filter((e) => e.type === 'network-request').length}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <input
              type="text"
              placeholder="Test name"
              value={testOptions.testName}
              onChange={(e) =>
                setTestOptions((prev) => ({
                  ...prev,
                  testName: e.target.value,
                }))
              }
              style={{
                width: '100%',
                padding: '4px',
                marginBottom: '4px',
                fontSize: '11px',
                border: 'none',
                borderRadius: '3px',
              }}
              data-test-id="test-name-input"
            />
            <input
              type="text"
              placeholder="Component name"
              value={testOptions.componentName}
              onChange={(e) =>
                setTestOptions((prev) => ({
                  ...prev,
                  componentName: e.target.value,
                }))
              }
              style={{
                width: '100%',
                padding: '4px',
                fontSize: '11px',
                border: 'none',
                borderRadius: '3px',
              }}
              data-test-id="component-name-input"
            />
          </div>

          <button
            onClick={handleGenerateTest}
            disabled={eventHistory.length === 0 && networkHistory.length === 0}
            style={{
              background:
                eventHistory.length === 0 && networkHistory.length === 0
                  ? '#666'
                  : '#FF9800',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor:
                eventHistory.length === 0 && networkHistory.length === 0
                  ? 'not-allowed'
                  : 'pointer',
              fontSize: '11px',
              width: '100%',
            }}
            data-test-id="generate-test-button"
          >
            Generate Test
          </button>
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontWeight: 'bold' }}>Generated Test</span>
            <button
              onClick={() => setShowOutput(false)}
              style={{
                background: '#666',
                color: 'white',
                border: 'none',
                padding: '2px 6px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px',
              }}
              data-test-id="close-test-output-button"
            >
              ✕
            </button>
          </div>

          {generatedTest && (
            <>
              <div
                style={{
                  marginBottom: '8px',
                  fontSize: '10px',
                  opacity: 0.8,
                }}
              >
                <div>Events: {generatedTest.summary.totalEvents}</div>
                <div>
                  Network calls: {generatedTest.summary.totalNetworkCalls}
                </div>
                <div>
                  Test IDs: {generatedTest.summary.uniqueTestIds.join(', ')}
                </div>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <div
                  style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}
                >
                  <button
                    onClick={() =>
                      copyToClipboard(generatedTest.testCode, 'Test code')
                    }
                    style={{
                      background: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      flex: 1,
                    }}
                    data-test-id="copy-test-code-button"
                  >
                    Copy Test
                  </button>
                  <button
                    onClick={() =>
                      copyToClipboard(generatedTest.mswHandlers, 'MSW handlers')
                    }
                    style={{
                      background: '#2196F3',
                      color: 'white',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      flex: 1,
                    }}
                    data-test-id="copy-msw-handlers-button"
                  >
                    Copy MSW
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() =>
                      downloadFile(
                        generatedTest.testCode,
                        `${testOptions.componentName}.test.jsx`
                      )
                    }
                    style={{
                      background: '#FF9800',
                      color: 'white',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      flex: 1,
                    }}
                    data-test-id="download-test-button"
                  >
                    Download Test
                  </button>
                  <button
                    onClick={() =>
                      downloadFile(generatedTest.mswHandlers, 'handlers.js')
                    }
                    style={{
                      background: '#9C27B0',
                      color: 'white',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      flex: 1,
                    }}
                    data-test-id="download-msw-button"
                  >
                    Download MSW
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  textAlign: 'left',
                }}
              >
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                  Test Code Preview:
                </div>
                {generatedTest.testCode}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default SnapTestProvider;
export { SnapTestProvider };

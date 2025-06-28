import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Test Generation Logic (from testGenerator.ts)
interface TestOptions {
  testName?: string;
  componentName?: string;
  describe?: string;
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
    | "click"
    | "assertion"
    | "network-request"
    | "network-response"
    | "network-error";
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
  options: TestOptions = {},
): GeneratedTest {
  const {
    testName = "should handle user interactions correctly",
    componentName = "MyComponent",
    describe = "MyComponent Integration Tests",
  } = options;

  const combinedEvents: CombinedEvent[] = [
    ...eventHistory.map((event): CombinedEvent => ({
      ...event,
      type: event.type,
      timestamp: new Date(event.timestamp).getTime(),
    })),
    ...networkHistory.map((event): CombinedEvent => ({
      id: event.id.toString(),
      testId: "",
      elementText: "",
      tagName: "",
      elementType: null,
      timestamp: event.timestamp,
      type: event.type as
        | "network-request"
        | "network-response"
        | "network-error",
      method: event.method,
      url: event.url,
      request: event.request,
      response: event.response,
      status: event.status,
      error: event.error,
    })),
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
    if (event.type === "network-response") {
      const method = event.method || "GET";
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
    const hasBody = handler.requestBody !== null &&
      ["post", "put", "patch"].includes(handler.method);

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

export const handlers = [${handlers.join(",")}\n]`;
}

function generateTestCode(
  combinedEvents: CombinedEvent[],
  { testName, componentName, describe }: Required<TestOptions>,
): string {
  const imports = [
    "import { render, screen, fireEvent, waitFor } from '@testing-library/react'",
    "import { rest } from 'msw'",
    "import { server } from '../mocks/server'",
    `import ${componentName} from './${componentName}'`,
  ];

  const testSteps = [];
  let stepNumber = 1;

  for (let i = 0; i < combinedEvents.length; i++) {
    const event = combinedEvents[i];
    const nextEvent = combinedEvents[i + 1];

    if (event.type === "click") {
      testSteps.push(`
    // Step ${stepNumber}: Click ${event.testId}
    const ${
        camelCase(event.testId)
      } = await screen.findByTestId('${event.testId}')
    fireEvent.click(${camelCase(event.testId)})`);
      stepNumber++;

      if (nextEvent && nextEvent.type === "network-response" && nextEvent.url) {
        const method = (nextEvent.method || "GET").toLowerCase();
        const url = new URL(nextEvent.url);
        const fullPath = url.pathname + url.search;
        const requestBody = nextEvent.request?.body || null;
        const hasBody = requestBody !== null &&
          ["post", "put", "patch"].includes(method);

        if (hasBody) {
          testSteps.push(`
    // Step ${stepNumber}: Setup mock for triggered request
    server.use(
      rest.${method}('*${fullPath}', async (req, res, ctx) => {
        const body = await req.text()
        if (body === ${JSON.stringify(requestBody)}) {
          return res(
            ctx.status(${nextEvent.status}),
            ctx.json(${JSON.stringify(nextEvent.response?.data, null, 8)})
          )
        }
        return res(ctx.status(400), ctx.text('Request body mismatch'))
      })
    )
    
    // Step ${stepNumber + 1}: Wait for network call to complete
    await waitFor(() => {
      expect(await screen.findByTestId('${event.testId}')).toBeInTheDocument()
    })`);
        } else {
          testSteps.push(`
    // Step ${stepNumber}: Setup mock for triggered request
    server.use(
      rest.${method}('*${fullPath}', (req, res, ctx) => {
        return res(
          ctx.status(${nextEvent.status}),
          ctx.json(${JSON.stringify(nextEvent.response?.data, null, 8)})
        )
      })
    )
    
    // Step ${stepNumber + 1}: Wait for network call to complete
    await waitFor(() => {
      expect(await screen.findByTestId('${event.testId}')).toBeInTheDocument()
    })`);
        }
        stepNumber += 2;
        i++;
      }
    } else if (event.type === "assertion") {
      testSteps.push(`
    // Step ${stepNumber}: Assert ${event.testId} text content
    expect(await screen.findByTestId('${event.testId}')).toHaveTextContent('${
        event.elementText.replace(/'/g, "\\'")
      }')`);
      stepNumber++;
    } else if (event.type === "network-response" && event.url) {
      const method = (event.method || "GET").toLowerCase();
      const url = new URL(event.url);
      const fullPath = url.pathname + url.search;
      const requestBody = event.request?.body || null;
      const hasBody = requestBody !== null &&
        ["post", "put", "patch"].includes(method);

      if (hasBody) {
        testSteps.push(`
    // Step ${stepNumber}: Setup mock for background request
    server.use(
      rest.${method}('*${fullPath}', async (req, res, ctx) => {
        const body = await req.text()
        if (body === ${JSON.stringify(requestBody)}) {
          return res(
            ctx.status(${event.status}),
            ctx.json(${JSON.stringify(event.response?.data, null, 8)})
          )
        }
        return res(ctx.status(400), ctx.text('Request body mismatch'))
      })
    )`);
      } else {
        testSteps.push(`
    // Step ${stepNumber}: Setup mock for background request
    server.use(
      rest.${method}('*${fullPath}', (req, res, ctx) => {
        return res(
          ctx.status(${event.status}),
          ctx.json(${JSON.stringify(event.response?.data, null, 8)})
        )
      })
    )`);
      }
      stepNumber++;
    }
  }

  const testCode = `${imports.join("\n")}

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
    // Render component
    render(<${componentName} />)
${testSteps.join("\n")}
  })
})`;

  return testCode;
}

function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase())
    .replace(/^[a-z]/, (match) => match.toLowerCase());
}

export function generateTestSuite(
  eventHistory: EventHistoryItem[],
  networkHistory: NetworkHistoryItem[],
  options: TestOptions = {},
): GeneratedTestSuite {
  const result = generateTest(eventHistory, networkHistory, options);

  return {
    ...result,
    summary: {
      totalEvents: eventHistory.length,
      totalNetworkCalls:
        networkHistory.filter((e) => e.type === "network-request").length,
      uniqueTestIds: [...new Set(eventHistory.map((e) => e.testId))],
      uniqueEndpoints: [
        ...new Set(
          networkHistory.filter((e) => e.type === "network-request").map((e) =>
            e.url
          ),
        ),
      ],
    },
  };
}

// Combined TestGeneratorProvider Logic
interface TestGeneratorProviderProps {
  children: React.ReactNode;
}

interface RecordedEvent {
  id: number;
  timestamp: string;
  testId: string;
  elementText: string;
  tagName: string;
  elementType?: string | null;
  type: "click" | "assertion";
  position: {
    x: number;
    y: number;
  };
  clickPosition: {
    x: number;
    y: number;
  };
}

interface TestGeneratorContextType {
  networkEvents: NetworkEvent[];
  isNetworkRecording: boolean;
  startNetworkRecording: () => void;
  stopNetworkRecording: () => void;
  clearNetworkEvents: () => void;
  recordedEvents: RecordedEvent[];
  isEventRecording: boolean;
  startEventRecording: () => void;
  stopEventRecording: () => void;
  clearEvents: () => void;
}

const TestGeneratorContext = createContext<TestGeneratorContextType | null>(
  null,
);

export const useTestGenerator = () => {
  const context = useContext(TestGeneratorContext);
  if (!context) {
    throw new Error(
      "useTestGenerator must be used within a TestGeneratorProvider",
    );
  }
  return context;
};

function TestGeneratorProvider({ children }: TestGeneratorProviderProps) {
  // Network recording state
  const [networkEvents, setNetworkEvents] = useState<NetworkEvent[]>([]);
  const [isNetworkRecording, setIsNetworkRecording] = useState(false);

  // Event recording state
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(
    null,
  );
  const [recordedEvents, setRecordedEvents] = useState<RecordedEvent[]>([]);
  const [isEventRecording, setIsEventRecording] = useState(false);
  const [assertionHighlight, setAssertionHighlight] = useState<Element | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const findClosestTestId = (element: Element): Element | null => {
    let current = element;
    while (current && current !== document.body) {
      if (current.getAttribute && current.getAttribute("data-test-id")) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  const handleMouseMove = (event: MouseEvent) => {
    const target = event.target as Element;
    const elementWithTestId = findClosestTestId(target);

    if (elementWithTestId !== highlightedElement) {
      if (highlightedElement) {
        (highlightedElement as HTMLElement).style.outline = "";
        (highlightedElement as HTMLElement).style.outlineOffset = "";
      }

      if (elementWithTestId) {
        (elementWithTestId as HTMLElement).style.outline = "2px solid red";
        (elementWithTestId as HTMLElement).style.outlineOffset = "2px";
      }

      setHighlightedElement(elementWithTestId);
    }
  };

  const handleMouseLeave = () => {
    if (highlightedElement) {
      highlightedElement.style.outline = "";
      highlightedElement.style.outlineOffset = "";
      setHighlightedElement(null);
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    if (!isEventRecording) return;

    const target = event.target as Element;
    const elementWithTestId = findClosestTestId(target);

    if (elementWithTestId) {
      const testId = elementWithTestId.getAttribute("data-test-id");
      const timestamp = new Date().toISOString();
      const elementText = elementWithTestId.innerText?.trim() || "";
      const tagName = elementWithTestId.tagName.toLowerCase();
      const elementType = elementWithTestId.type || null;
      const rect = elementWithTestId.getBoundingClientRect();

      if (event.ctrlKey) {
        event.stopPropagation();

        setAssertionHighlight(elementWithTestId);
        (elementWithTestId as HTMLElement).style.outline = "3px solid orange";
        (elementWithTestId as HTMLElement).style.outlineOffset = "3px";

        setTimeout(() => {
          (elementWithTestId as HTMLElement).style.outline = "";
          (elementWithTestId as HTMLElement).style.outlineOffset = "";
          setAssertionHighlight(null);
        }, 1000);

        const eventData = {
          id: Date.now() + Math.random(),
          timestamp,
          testId,
          elementText,
          tagName,
          elementType,
          type: "assertion" as const,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
          clickPosition: {
            x: event.clientX,
            y: event.clientY,
          },
        };

        setRecordedEvents((prev) => [...prev, eventData]);
        return;
      }

      const eventData = {
        id: Date.now() + Math.random(),
        timestamp,
        testId,
        elementText,
        tagName,
        elementType,
        type: "click" as const,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
        clickPosition: {
          x: event.clientX,
          y: event.clientY,
        },
      };

      setRecordedEvents((prev) => [...prev, eventData]);
    }
  };

  const startEventRecording = () => setIsEventRecording(true);
  const stopEventRecording = () => setIsEventRecording(false);
  const clearEvents = () => setRecordedEvents([]);

  const startNetworkRecording = () => {
    setNetworkEvents([]);
    setIsNetworkRecording(true);
  };
  const stopNetworkRecording = () => setIsNetworkRecording(false);
  const clearNetworkEvents = () => setNetworkEvents([]);

  // Network interception effect
  useEffect(() => {
    if (!isNetworkRecording) return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const requestId = crypto.randomUUID();
      const [resource, config] = args;

      const url = typeof resource === "string" ? resource : resource.url;
      const method = config?.method || "GET";

      const requestEvent: NetworkEvent = {
        id: requestId,
        type: "network-request",
        method,
        url,
        timestamp: Date.now(),
        request: {
          body: (config?.body as string) || null,
        },
      };

      setNetworkEvents((prev) => [...prev, requestEvent]);

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

          const responseEvent: NetworkEvent = {
            id: requestId,
            type: "network-response",
            status: response.status,
            url,
            timestamp: Date.now(),
            response: {
              data: responseData,
            },
          };

          setNetworkEvents((prev) => [...prev, responseEvent]);
        } catch (error) {}

        return response;
      } catch (error) {
        const errorEvent: NetworkEvent = {
          id: requestId,
          type: "network-error",
          url,
          timestamp: Date.now(),
          error: (error as Error).message,
        };

        setNetworkEvents((prev) => [...prev, errorEvent]);
        throw error;
      }
    };

    return () => window.fetch = originalFetch;
  }, [isNetworkRecording]);

  // Mouse event listeners effect
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", handleMouseLeave);
      container.addEventListener("click", handleClick, true);

      return () => {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", handleMouseLeave);
        container.removeEventListener("click", handleClick, true);
        if (highlightedElement) {
          highlightedElement.style.outline = "";
          highlightedElement.style.outlineOffset = "";
        }
      };
    }
  }, [highlightedElement, isEventRecording]);

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
  };

  return (
    <TestGeneratorContext.Provider value={contextValue}>
      <div ref={containerRef} style={{ minHeight: "100vh" }}>
        {children}

        {/* Event Recording Panel */}
        <div
          style={{
            position: "fixed",
            top: "10px",
            left: "10px",
            background: "rgba(0, 0, 0, 0.9)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontFamily: "monospace",
            zIndex: 1000,
            minWidth: "200px",
          }}
        >
          <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
            Event Recording
          </div>
          <div style={{ marginBottom: "8px", fontSize: "10px", opacity: 0.8 }}>
            Events: {recordedEvents.filter((e) => e.type === "click").length}
            {" "}
            | Assertions:{" "}
            {recordedEvents.filter((e) => e.type === "assertion").length}
          </div>
          <div style={{ marginBottom: "8px" }}>
            <button
              onClick={isEventRecording
                ? stopEventRecording
                : startEventRecording}
              style={{
                background: isEventRecording ? "#ff4444" : "#4CAF50",
                color: "white",
                border: "none",
                padding: "4px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                marginRight: "8px",
                fontSize: "11px",
              }}
            >
              {isEventRecording ? "Stop" : "Start"} Recording
            </button>
            <button
              onClick={clearEvents}
              style={{
                background: "#666",
                color: "white",
                border: "none",
                padding: "4px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
              }}
            >
              Clear ({recordedEvents.length})
            </button>
          </div>
          {isEventRecording && (
            <div style={{ color: "#ff4444" }}>● Recording clicks...</div>
          )}
          {isEventRecording && (
            <div style={{ color: "#888", fontSize: "10px", marginTop: "4px" }}>
              Ctrl+Click for assertions
            </div>
          )}
        </div>

        {/* Network Recording Panel */}
        <div
          style={{
            position: "fixed",
            top: "10px",
            left: "250px",
            background: "rgba(0, 0, 0, 0.9)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontFamily: "monospace",
            zIndex: 1000,
            minWidth: "200px",
          }}
        >
          <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
            Network Recording
          </div>
          <div style={{ marginBottom: "8px" }}>
            <button
              onClick={isNetworkRecording
                ? stopNetworkRecording
                : startNetworkRecording}
              style={{
                background: isNetworkRecording ? "#ff4444" : "#2196F3",
                color: "white",
                border: "none",
                padding: "4px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                marginRight: "8px",
                fontSize: "11px",
              }}
            >
              {isNetworkRecording ? "Stop" : "Start"} Recording
            </button>
            <button
              onClick={clearNetworkEvents}
              style={{
                background: "#666",
                color: "white",
                border: "none",
                padding: "4px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
              }}
            >
              Clear ({networkEvents.length})
            </button>
          </div>
          {isNetworkRecording && (
            <div style={{ color: "#2196F3" }}>● Recording network...</div>
          )}
        </div>

        {recordedEvents.length > 0 && (
          <div
            style={{
              position: "fixed",
              bottom: "10px",
              right: highlightedElement ? "320px" : "10px",
              left: "50%",
              background: "rgba(0, 0, 0, 0.9)",
              color: "white",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "11px",
              fontFamily: "monospace",
              zIndex: 1000,
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
              Recorded Events ({recordedEvents.length})
            </div>
            {recordedEvents.slice(-10).map((event) => (
              <div
                key={event.id}
                style={{
                  marginBottom: "8px",
                  padding: "6px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  fontSize: "10px",
                }}
              >
                <div
                  style={{
                    color: event.type === "assertion" ? "#FF9800" : "#4CAF50",
                  }}
                >
                  {event.type === "assertion" ? "assertion" : "click"}:{" "}
                  {event.testId}
                </div>
                <div style={{ opacity: 0.8 }}>
                  time: {new Date(event.timestamp).toLocaleTimeString()}
                </div>
                <div style={{ opacity: 0.8 }}>
                  element: {event.tagName}
                  {event.elementType ? `[${event.elementType}]` : ""}
                </div>
                {event.elementText && (
                  <div style={{ opacity: 0.8 }}>
                    text: "{event.elementText.length > 30
                      ? event.elementText.substring(0, 30) + "..."
                      : event.elementText}"
                  </div>
                )}
              </div>
            ))}
            {recordedEvents.length > 10 && (
              <div style={{ opacity: 0.6, textAlign: "center" }}>
                ... showing last 10 events
              </div>
            )}
          </div>
        )}

        {highlightedElement && (
          <div
            style={{
              position: "fixed",
              bottom: "10px",
              right: "10px",
              width: "300px",
              background: "rgba(0, 0, 0, 0.9)",
              color: "white",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontFamily: "monospace",
              zIndex: 1000,
              pointerEvents: "none",
              maxHeight: "200px",
              wordBreak: "break-word",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                marginBottom: "4px",
                fontWeight: "bold",
                color: "#ff6b6b",
              }}
            >
              Element Info
            </div>
            <div style={{ color: "#4CAF50" }}>
              data-test-id: {highlightedElement.getAttribute("data-test-id")}
            </div>
            {(() => {
              const text = highlightedElement.innerText?.trim();
              if (text && text.length > 0) {
                const truncatedText = text.length > 100
                  ? text.substring(0, 100) + "..."
                  : text;
                return (
                  <div style={{ marginTop: "4px", opacity: 0.8 }}>
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
            style={{
              position: "fixed",
              bottom: "10px",
              left: "10px",
              right: recordedEvents.length > 0 ? "50%" : "10px",
              maxHeight: "200px",
              background: "rgba(0, 0, 0, 0.9)",
              color: "white",
              padding: "10px",
              borderRadius: "4px",
              fontSize: "11px",
              fontFamily: "monospace",
              overflow: "auto",
              zIndex: 999,
            }}
          >
            <div>
              <strong>Network Events Log:</strong>
            </div>
            {networkEvents.map((event, index) => (
              <div key={index} style={{ marginBottom: "5px" }}>
                {event.type === "network-request"
                  ? (
                    <span style={{ color: "#87CEEB" }}>
                      → {event.method} {event.url}
                    </span>
                  )
                  : (
                    <span style={{ color: "#90EE90" }}>
                      ← {event.status} (Response)
                    </span>
                  )}
                <span style={{ color: "#ddd", marginLeft: "10px" }}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}

        <TestGenerator />
      </div>
    </TestGeneratorContext.Provider>
  );
}

interface NetworkEvent {
  id: string;
  type: "network-request" | "network-response" | "network-error";
  method?: string;
  url: string;
  timestamp: number;
  status?: number;
  request?: {
    body: string | null;
  };
  response?: {
    data: unknown;
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
  type: "click" | "assertion";
}

interface NetworkHistoryItem {
  id: string;
  type: "network-request" | "network-response" | "network-error";
  method?: string;
  url: string;
  timestamp: number;
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

function TestGenerator() {
  const { recordedEvents: eventHistory, networkEvents: networkHistory } =
    useTestGenerator();
  const [generatedTest, setGeneratedTest] = useState<GeneratedTestSuite | null>(
    null,
  );
  const [showOutput, setShowOutput] = useState(false);
  const [testOptions, setTestOptions] = useState({
    testName: "should handle user interactions correctly",
    componentName: "MyComponent",
    describe: "MyComponent Integration Tests",
  });

  const handleGenerateTest = () => {
    if (eventHistory.length === 0 && networkHistory.length === 0) {
      alert(
        "No events or network activity recorded. Start recording and interact with the app first.",
      );
      return;
    }

    const result = generateTestSuite(eventHistory, networkHistory, testOptions);
    setGeneratedTest(result);
    setShowOutput(true);
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${type} copied to clipboard!`);
    }).catch(() => {
      alert("Failed to copy to clipboard");
    });
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        background: "rgba(0, 0, 0, 0.9)",
        color: "white",
        padding: "12px",
        borderRadius: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
        zIndex: 1000,
        minWidth: "200px",
        maxWidth: showOutput ? "600px" : "200px",
        maxHeight: showOutput ? "80vh" : "auto",
        overflowY: "auto",
      }}
    >
      <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
        Test Generator
      </div>

      {!showOutput
        ? (
          <>
            <div
              style={{ marginBottom: "8px", fontSize: "10px", opacity: 0.8 }}
            >
              Events: {eventHistory.filter((e) => e.type === "click").length}
              {" "}
              | Assertions:{" "}
              {eventHistory.filter((e) => e.type === "assertion").length}{" "}
              | Network:{" "}
              {networkHistory.filter((e) => e.type === "network-request")
                .length}
            </div>

            <div style={{ marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Test name"
                value={testOptions.testName}
                onChange={(e) =>
                  setTestOptions((prev) => ({
                    ...prev,
                    testName: e.target.value,
                  }))}
                style={{
                  width: "100%",
                  padding: "4px",
                  marginBottom: "4px",
                  fontSize: "11px",
                  border: "none",
                  borderRadius: "3px",
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
                  }))}
                style={{
                  width: "100%",
                  padding: "4px",
                  fontSize: "11px",
                  border: "none",
                  borderRadius: "3px",
                }}
                data-test-id="component-name-input"
              />
            </div>

            <button
              onClick={handleGenerateTest}
              disabled={eventHistory.length === 0 &&
                networkHistory.length === 0}
              style={{
                background:
                  (eventHistory.length === 0 && networkHistory.length === 0)
                    ? "#666"
                    : "#FF9800",
                color: "white",
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
                cursor:
                  (eventHistory.length === 0 && networkHistory.length === 0)
                    ? "not-allowed"
                    : "pointer",
                fontSize: "11px",
                width: "100%",
              }}
              data-test-id="generate-test-button"
            >
              Generate Test
            </button>
          </>
        )
        : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontWeight: "bold" }}>Generated Test</span>
              <button
                onClick={() => setShowOutput(false)}
                style={{
                  background: "#666",
                  color: "white",
                  border: "none",
                  padding: "2px 6px",
                  borderRadius: "3px",
                  cursor: "pointer",
                  fontSize: "10px",
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
                    marginBottom: "8px",
                    fontSize: "10px",
                    opacity: 0.8,
                  }}
                >
                  <div>Events: {generatedTest.summary.totalEvents}</div>
                  <div>
                    Network calls: {generatedTest.summary.totalNetworkCalls}
                  </div>
                  <div>
                    Test IDs: {generatedTest.summary.uniqueTestIds.join(", ")}
                  </div>
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <div
                    style={{ display: "flex", gap: "4px", marginBottom: "4px" }}
                  >
                    <button
                      onClick={() =>
                        copyToClipboard(generatedTest.testCode, "Test code")}
                      style={{
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "3px",
                        cursor: "pointer",
                        fontSize: "10px",
                        flex: 1,
                      }}
                      data-test-id="copy-test-code-button"
                    >
                      Copy Test
                    </button>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          generatedTest.mswHandlers,
                          "MSW handlers",
                        )}
                      style={{
                        background: "#2196F3",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "3px",
                        cursor: "pointer",
                        fontSize: "10px",
                        flex: 1,
                      }}
                      data-test-id="copy-msw-handlers-button"
                    >
                      Copy MSW
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() =>
                        downloadFile(
                          generatedTest.testCode,
                          `${testOptions.componentName}.test.jsx`,
                        )}
                      style={{
                        background: "#FF9800",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "3px",
                        cursor: "pointer",
                        fontSize: "10px",
                        flex: 1,
                      }}
                      data-test-id="download-test-button"
                    >
                      Download Test
                    </button>
                    <button
                      onClick={() =>
                        downloadFile(generatedTest.mswHandlers, "handlers.js")}
                      style={{
                        background: "#9C27B0",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "3px",
                        cursor: "pointer",
                        fontSize: "10px",
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
                    background: "rgba(255, 255, 255, 0.1)",
                    padding: "8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    maxHeight: "300px",
                    overflowY: "auto",
                    textAlign: "left",
                  }}
                >
                  <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
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

export default TestGeneratorProvider;
export { TestGeneratorProvider };

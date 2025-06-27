interface EventHistoryItem {
  id: string | number;
  timestamp: string;
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
}

interface NetworkHistoryItem {
  id: string;
  type: "network-request" | "network-response" | "network-error";
  method?: string;
  url: string;
  timestamp: number;
  request?: {
    headers: Record<string, string>;
    body: string | null;
  };
  response?: {
    headers: Record<string, string>;
    data: unknown;
  };
  status?: number;
  error?: string;
}

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
  type: "click" | "network-request" | "network-response" | "network-error";
  method?: string;
  url?: string;
  request?: {
    headers: Record<string, string>;
    body: string | null;
  };
  response?: {
    headers: Record<string, string>;
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

export function generateTest(
  eventHistory: EventHistoryItem[],
  networkHistory: NetworkHistoryItem[],
  options: TestOptions = {}
): GeneratedTest {
  const {
    testName = "Generated Integration Test",
    componentName = "Component",
    describe = "Integration Test",
  } = options;

  // Combine and sort events by timestamp
  const combinedEvents: CombinedEvent[] = [
    ...eventHistory.map((event): CombinedEvent => ({
      ...event,
      type: "click" as const,
      timestamp: new Date(event.timestamp).getTime(),
    })),
    ...networkHistory.map((event): CombinedEvent => ({
      id: event.id.toString(),
      testId: "", // Network events don't have testIds
      elementText: "",
      tagName: "",
      elementType: null,
      timestamp: event.timestamp,
      type: event.type as "network-request" | "network-response" | "network-error",
      method: event.method,
      url: event.url,
      request: event.request,
      response: event.response,
      status: event.status,
      error: event.error,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  // Generate MSW handlers from network events
  const mswHandlers = generateMSWHandlers(networkHistory);

  // Generate test code
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
  // Create a map of unique endpoints and their first response for default handlers
  const defaultHandlers = new Map();

  networkHistory.forEach((event) => {
    if (event.type === "network-response") {
      const method = event.method || "GET";
      const url = new URL(event.url);
      const fullPath = url.pathname + url.search; // Include query parameters
      const requestBody = event.request?.body || null;
      const key = `${method}-${fullPath}-${JSON.stringify(requestBody)}`;

      // Only store the first response as default
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
  http.${handler.method}('*${handler.fullPath}', async ({ request }) => {
    const body = await request.text()
    if (body === ${JSON.stringify(handler.requestBody)}) {
      return HttpResponse.json(${JSON.stringify(handler.data, null, 4)}, {
        status: ${handler.status}
      })
    }
    return new Response('Request body mismatch', { status: 400 })
  })`);
    } else {
      handlers.push(`
  http.${handler.method}('*${handler.fullPath}', () => {
    return HttpResponse.json(${JSON.stringify(handler.data, null, 4)}, {
      status: ${handler.status}
    })
  })`);
    }
  });

  return `import { http, HttpResponse } from 'msw'

export const handlers = [${handlers.join(",")}\n]`;
}

function generateTestCode(
  combinedEvents: CombinedEvent[],
  { testName, componentName, describe }: Required<TestOptions>,
): string {
  const imports = [
    "import { render, screen, fireEvent, waitFor } from '@testing-library/react'",
    "import { http, HttpResponse } from 'msw'",
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
    const ${camelCase(event.testId)} = screen.getByTestId('${event.testId}')
    fireEvent.click(${camelCase(event.testId)})`);
      stepNumber++;

      // Check if the next event is a network response that should be mocked
      if (nextEvent && nextEvent.type === "network-response" && nextEvent.url) {
        const method = (nextEvent.method || "GET").toLowerCase();
        const url = new URL(nextEvent.url);
        const fullPath = url.pathname + url.search; // Include query parameters
        const requestBody = nextEvent.request?.body || null;
        const hasBody = requestBody !== null &&
          ["post", "put", "patch"].includes(method);

        if (hasBody) {
          testSteps.push(`
    // Step ${stepNumber}: Setup mock for triggered request
    server.use(
      http.${method}('*${fullPath}', async ({ request }) => {
        const body = await request.text()
        if (body === ${JSON.stringify(requestBody)}) {
          return HttpResponse.json(${
            JSON.stringify(nextEvent.response?.data, null, 8)
          }, {
            status: ${nextEvent.status}
          })
        }
        return new Response('Request body mismatch', { status: 400 })
      })
    )
    
    // Step ${stepNumber + 1}: Wait for network call to complete
    await waitFor(() => {
      // Verify the request was processed - you can add specific assertions here
      expect(screen.getByTestId('${event.testId}')).toBeInTheDocument()
    })`);
        } else {
          testSteps.push(`
    // Step ${stepNumber}: Setup mock for triggered request
    server.use(
      http.${method}('*${fullPath}', () => {
        return HttpResponse.json(${
            JSON.stringify(nextEvent.response?.data, null, 8)
          }, {
          status: ${nextEvent.status}
        })
      })
    )
    
    // Step ${stepNumber + 1}: Wait for network call to complete
    await waitFor(() => {
      // Verify the request was processed - you can add specific assertions here
      expect(screen.getByTestId('${event.testId}')).toBeInTheDocument()
    })`);
        }
        stepNumber += 2;
        i++; // Skip the network response event since we handled it
      }
    } else if (event.type === "network-response" && event.url) {
      // Handle standalone network responses (initial page loads, etc.)
      const method = (event.method || "GET").toLowerCase();
      const url = new URL(event.url);
      const fullPath = url.pathname + url.search; // Include query parameters
      const requestBody = event.request?.body || null;
      const hasBody = requestBody !== null &&
        ["post", "put", "patch"].includes(method);

      if (hasBody) {
        testSteps.push(`
    // Step ${stepNumber}: Setup mock for background request
    server.use(
      http.${method}('*${fullPath}', async ({ request }) => {
        const body = await request.text()
        if (body === ${JSON.stringify(requestBody)}) {
          return HttpResponse.json(${
          JSON.stringify(event.response?.data, null, 8)
        }, {
            status: ${event.status}
          })
        }
        return new Response('Request body mismatch', { status: 400 })
      })
    )`);
      } else {
        testSteps.push(`
    // Step ${stepNumber}: Setup mock for background request
    server.use(
      http.${method}('*${fullPath}', () => {
        return HttpResponse.json(${
          JSON.stringify(event.response?.data, null, 8)
        }, {
          status: ${event.status}
        })
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
  options: TestOptions = {}
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

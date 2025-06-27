export function generateTest(eventHistory, networkHistory, options = {}) {
  const {
    testName = "Generated Integration Test",
    componentName = "Component",
    describe = "Integration Test",
  } = options;

  // Combine and sort events by timestamp
  const combinedEvents = [
    ...eventHistory.map((event) => ({
      ...event,
      type: "click",
      timestamp: new Date(event.timestamp).getTime(),
    })),
    ...networkHistory.map((event) => ({
      ...event,
      timestamp: event.timestamp,
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

function generateMSWHandlers(networkHistory) {
  const handlers = [];
  const handlerMap = new Map();

  networkHistory.forEach((event) => {
    if (event.type === "network-response") {
      const key = `${event.method || "GET"}-${event.url}`;

      if (!handlerMap.has(key)) {
        handlerMap.set(key, []);
      }

      handlerMap.get(key).push({
        status: event.status,
        data: event.response?.data,
        headers: event.response?.headers || {},
      });
    }
  });

  handlerMap.forEach((responses, key) => {
    const [method, url] = key.split("-", 2);
    const urlPattern = new URL(url).pathname;

    if (responses.length === 1) {
      // Single response
      const response = responses[0];
      handlers.push(`
  http.${method.toLowerCase()}('*${urlPattern}', () => {
    return HttpResponse.json(${JSON.stringify(response.data, null, 4)}, {
      status: ${response.status}
    })
  })`);
    } else {
      // Multiple responses (sequence)
      handlers.push(`
  http.${method.toLowerCase()}('*${urlPattern}', ({ request }) => {
    const callCount = mockCallCounts.get('${key}') || 0
    mockCallCounts.set('${key}', callCount + 1)
    
    const responses = ${JSON.stringify(responses, null, 4)}
    const response = responses[callCount] || responses[responses.length - 1]
    
    return HttpResponse.json(response.data, {
      status: response.status
    })
  })`);
    }
  });

  const hasSequentialCalls = Array.from(handlerMap.values()).some((responses) =>
    responses.length > 1
  );

  return `import { http, HttpResponse } from 'msw'

${hasSequentialCalls ? "const mockCallCounts = new Map()\n" : ""}
export const handlers = [${handlers.join(",")}\n]`;
}

function generateTestCode(
  combinedEvents,
  { testName, componentName, describe },
) {
  const imports = [
    "import { render, screen, fireEvent, waitFor } from '@testing-library/react'",
    "import { server } from '../mocks/server'",
    `import ${componentName} from './${componentName}'`,
  ];

  const testSteps = [];
  let stepNumber = 1;

  combinedEvents.forEach((event) => {
    if (event.type === "click") {
      testSteps.push(`
    // Step ${stepNumber}: Click ${event.testId}
    const ${camelCase(event.testId)} = screen.getByTestId('${event.testId}')
    fireEvent.click(${camelCase(event.testId)})`);
      stepNumber++;
    } else if (event.type === "network-response") {
      testSteps.push(`
    // Step ${stepNumber}: Wait for network response
    await waitFor(() => {
      // Network call completed: ${event.url}
    })`);
      stepNumber++;
    }
  });

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

function camelCase(str) {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase())
    .replace(/^[a-z]/, (match) => match.toLowerCase());
}

export function generateTestSuite(eventHistory, networkHistory, options = {}) {
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

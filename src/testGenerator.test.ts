import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { generateTest, generateTestSuite } from "./testGenerator.ts";

Deno.test("generateTest - basic click and network flow", () => {
  const eventHistory = [
    {
      id: 1,
      timestamp: "2024-01-01T10:00:00.000Z",
      testId: "submit-button",
      elementText: "Submit",
      tagName: "button",
      elementType: null,
    },
  ];

  const networkHistory = [
    {
      id: "req-1",
      type: "network-request" as const,
      method: "POST",
      url: "https://api.example.com/submit",
      timestamp: 1704110400100,
      request: {
        headers: { "Content-Type": "application/json" },
        body: '{"data":"test"}',
      },
    },
    {
      id: "req-1",
      type: "network-response" as const,
      status: 201,
      url: "https://api.example.com/submit",
      timestamp: 1704110400200,
      response: {
        headers: { "Content-Type": "application/json" },
        data: { success: true, id: 123 },
      },
      request: {
        headers: { "Content-Type": "application/json" },
        body: '{"data":"test"}',
      },
      method: "POST",
    },
  ];

  const result = generateTest(eventHistory, networkHistory, {
    testName: "Submit form test",
    componentName: "MyForm",
    describe: "Form Tests",
  });

  // Test that MSW handlers are generated correctly
  assertEquals(result.mswHandlers.includes("http.post"), true);
  assertEquals(result.mswHandlers.includes("*/submit"), true);
  assertEquals(result.mswHandlers.includes('"{\\"data\\":\\"test\\"}"'), true);

  // Test that test code includes expected elements
  assertEquals(result.testCode.includes("Submit form test"), true);
  assertEquals(result.testCode.includes("MyForm"), true);
  assertEquals(result.testCode.includes("submit-button"), true);
  assertEquals(result.testCode.includes("fireEvent.click"), true);
  assertEquals(result.testCode.includes("server.use"), true);
});

Deno.test("generateTest - GET request without body", () => {
  const eventHistory = [
    {
      id: 1,
      timestamp: "2024-01-01T10:00:00.000Z",
      testId: "load-data-button",
      elementText: "Load Data",
      tagName: "button",
      elementType: null,
    },
  ];

  const networkHistory = [
    {
      id: "req-1",
      type: "network-request" as const,
      method: "GET",
      url: "https://api.example.com/data?page=1&limit=10",
      timestamp: 1704110400100,
      request: {
        headers: {},
        body: null,
      },
    },
    {
      id: "req-1",
      type: "network-response" as const,
      status: 200,
      url: "https://api.example.com/data?page=1&limit=10",
      timestamp: 1704110400200,
      response: {
        headers: { "Content-Type": "application/json" },
        data: { items: [1, 2, 3], total: 100 },
      },
      method: "GET",
    },
  ];

  const result = generateTest(eventHistory, networkHistory);

  // Should include query parameters in URL pattern
  assertEquals(result.mswHandlers.includes("*/data?page=1&limit=10"), true);

  // Should not include request body validation for GET
  assertEquals(result.mswHandlers.includes("request.text()"), false);
  assertEquals(result.mswHandlers.includes("body ==="), false);

  // Test code should setup mock without body validation
  assertEquals(result.testCode.includes("*/data?page=1&limit=10"), true);
  assertEquals(result.testCode.includes("async ({ request })"), false);
});

Deno.test("generateTest - POST request with body validation", () => {
  const eventHistory: never[] = [];
  const networkHistory = [
    {
      id: "req-1",
      type: "network-response" as const,
      status: 201,
      url: "https://api.example.com/users",
      timestamp: 1704110400200,
      response: {
        headers: { "Content-Type": "application/json" },
        data: { id: 456, name: "John Doe" },
      },
      request: {
        headers: { "Content-Type": "application/json" },
        body: '{"name":"John Doe","email":"john@example.com"}',
      },
      method: "POST",
    },
  ];

  const result = generateTest(eventHistory, networkHistory);

  // Should include request body validation
  assertEquals(result.mswHandlers.includes("async ({ request })"), true);
  assertEquals(result.mswHandlers.includes("request.text()"), true);
  assertEquals(
    result.mswHandlers.includes(
      '"{\\"name\\":\\"John Doe\\",\\"email\\":\\"john@example.com\\"}"',
    ),
    true,
  );
  assertEquals(
    result.mswHandlers.includes("Request body mismatch"),
    true,
  );
});

Deno.test("generateTest - multiple events in sequence", () => {
  const eventHistory = [
    {
      id: 1,
      timestamp: "2024-01-01T10:00:00.000Z",
      testId: "first-button",
      elementText: "First",
      tagName: "button",
    },
    {
      id: 2,
      timestamp: "2024-01-01T10:00:02.000Z",
      testId: "second-button",
      elementText: "Second",
      tagName: "button",
    },
  ];

  const networkHistory = [
    {
      id: "req-1",
      type: "network-response" as const,
      status: 200,
      url: "https://api.example.com/first",
      timestamp: 1704110400500,
      response: { 
        headers: { "Content-Type": "application/json" },
        data: { step: 1 } 
      },
      method: "GET",
    },
    {
      id: "req-2",
      type: "network-response" as const,
      status: 200,
      url: "https://api.example.com/second",
      timestamp: 1704110402500,
      response: { 
        headers: { "Content-Type": "application/json" },
        data: { step: 2 } 
      },
      method: "GET",
    },
  ];

  const result = generateTest(eventHistory, networkHistory);

  // Should handle multiple clicks and network calls
  const testCode = result.testCode;
  assertEquals(testCode.includes("first-button"), true);
  assertEquals(testCode.includes("second-button"), true);
  assertEquals(testCode.includes("*/first"), true);
  assertEquals(testCode.includes("*/second"), true);

  // Should maintain proper sequence
  const firstButtonIndex = testCode.indexOf("first-button");
  const secondButtonIndex = testCode.indexOf("second-button");
  assertEquals(firstButtonIndex < secondButtonIndex, true);
});

Deno.test("generateTestSuite - includes summary", () => {
  const eventHistory = [
    {
      id: 1,
      timestamp: "2024-01-01T10:00:00.000Z",
      testId: "button-1",
      elementText: "Click me",
      tagName: "button",
    },
    {
      id: 2,
      timestamp: "2024-01-01T10:00:01.000Z",
      testId: "button-2",
      elementText: "Click me too",
      tagName: "button",
    },
  ];

  const networkHistory = [
    {
      id: "req-1",
      type: "network-request" as const,
      method: "GET",
      url: "https://api.example.com/data",
      timestamp: 1704110400100,
    },
    {
      id: "req-1",
      type: "network-response" as const,
      status: 200,
      url: "https://api.example.com/data",
      timestamp: 1704110400200,
      response: { 
        headers: { "Content-Type": "application/json" },
        data: [] 
      },
      method: "GET",
    },
  ];

  const result = generateTestSuite(eventHistory, networkHistory);

  assertEquals(result.summary.totalEvents, 2);
  assertEquals(result.summary.totalNetworkCalls, 1);
  assertEquals(result.summary.uniqueTestIds.length, 2);
  assertEquals(result.summary.uniqueTestIds.includes("button-1"), true);
  assertEquals(result.summary.uniqueTestIds.includes("button-2"), true);
  assertEquals(result.summary.uniqueEndpoints.length, 1);
  assertEquals(
    result.summary.uniqueEndpoints.includes("https://api.example.com/data"),
    true,
  );
});

Deno.test("generateTest - camelCase conversion", () => {
  const eventHistory = [
    {
      id: 1,
      timestamp: "2024-01-01T10:00:00.000Z",
      testId: "my-long-test-id",
      elementText: "Button",
      tagName: "button",
    },
  ];

  const result = generateTest(eventHistory, []);

  // Should convert kebab-case to camelCase
  assertEquals(result.testCode.includes("myLongTestId"), true);
  assertEquals(
    result.testCode.includes("getByTestId('my-long-test-id')"),
    true,
  );
});

import { useState } from "react";
import { generateTestSuite } from "./testGenerator.ts";

interface EventHistoryItem {
  id: string | number;
  timestamp: string;
  testId: string;
  elementText: string;
  tagName: string;
  elementType?: string | null;
}

interface NetworkHistoryItem {
  id: string;
  type: "network-request" | "network-response" | "network-error";
  method?: string;
  url: string;
  timestamp: number;
}

interface TestGeneratorProps {
  eventHistory: EventHistoryItem[];
  networkHistory: NetworkHistoryItem[];
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

function TestGenerator({ eventHistory, networkHistory }: TestGeneratorProps) {
  const [generatedTest, setGeneratedTest] = useState<GeneratedTestSuite | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [testOptions, setTestOptions] = useState({
    testName: "User interaction flow test",
    componentName: "PokemonData",
    describe: "PokemonData Integration Tests",
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
        bottom: "10px",
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
              Events: {eventHistory.length} | Network:{" "}
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
                  {generatedTest.testCode.substring(0, 500)}
                  {generatedTest.testCode.length > 500 && "\n...(truncated)"}
                </div>
              </>
            )}
          </>
        )}
    </div>
  );
}

export default TestGenerator;

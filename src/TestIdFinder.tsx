import { useEffect, useRef, useState } from "react";
import { useNetworkEvents } from "./NetworkInterceptor.tsx";
import TestGenerator from "./TestGenerator.tsx";

interface TestIdFinderProps {
  children: React.ReactNode;
}

interface RecordedEvent {
  id: number;
  timestamp: string;
  testId: string;
  elementText: string;
  tagName: string;
  elementType?: string | null;
  position: {
    x: number;
    y: number;
  };
  clickPosition: {
    x: number;
    y: number;
  };
}

function TestIdFinder({ children }: TestIdFinderProps) {
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const [recordedEvents, setRecordedEvents] = useState<RecordedEvent[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { networkEvents } = useNetworkEvents();

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
    if (!isRecording) return;

    const target = event.target as Element;
    const elementWithTestId = findClosestTestId(target);

    if (elementWithTestId) {
      const testId = elementWithTestId.getAttribute("data-test-id");
      const timestamp = new Date().toISOString();
      const elementText = elementWithTestId.innerText?.trim() || "";
      const tagName = elementWithTestId.tagName.toLowerCase();
      const elementType = elementWithTestId.type || null;
      const rect = elementWithTestId.getBoundingClientRect();

      const eventData = {
        id: Date.now() + Math.random(),
        timestamp,
        testId,
        elementText,
        tagName,
        elementType,
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

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const clearEvents = () => {
    setRecordedEvents([]);
  };

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
  }, [highlightedElement, isRecording]);

  return (
    <div ref={containerRef} style={{ minHeight: "100vh" }}>
      {children}

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
        <div style={{ marginBottom: "8px" }}>
          <button
            onClick={toggleRecording}
            style={{
              background: isRecording ? "#ff4444" : "#4CAF50",
              color: "white",
              border: "none",
              padding: "4px 8px",
              borderRadius: "4px",
              cursor: "pointer",
              marginRight: "8px",
              fontSize: "11px",
            }}
          >
            {isRecording ? "Stop" : "Start"} Recording
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
        {isRecording && (
          <div style={{ color: "#ff4444" }}>● Recording clicks...</div>
        )}
      </div>

      {recordedEvents.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: "10px",
            right: "10px",
            background: "rgba(0, 0, 0, 0.9)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "11px",
            fontFamily: "monospace",
            zIndex: 1000,
            maxWidth: "400px",
            maxHeight: "400px",
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
              <div style={{ color: "#4CAF50" }}>test-id: {event.testId}</div>
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
            background: "rgba(0, 0, 0, 0.9)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontFamily: "monospace",
            zIndex: 1000,
            pointerEvents: "none",
            maxWidth: "300px",
            wordBreak: "break-word",
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

      <TestGenerator
        eventHistory={recordedEvents}
        networkHistory={networkEvents}
      />
    </div>
  );
}

export default TestIdFinder;

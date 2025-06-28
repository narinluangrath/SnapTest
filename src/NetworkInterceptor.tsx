import { createContext, ReactNode, useContext, useEffect, useState } from "react";

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

interface NetworkContextType {
  networkEvents: NetworkEvent[];
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  clearEvents: () => void;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

export const useNetworkEvents = () => {
  const context = useContext(NetworkContext);
  if (!context) throw new Error("useNetworkEvents must be used within a NetworkInterceptor");
  return context;
};

function NetworkInterceptor({ children }: { children: ReactNode }) {
  const [networkEvents, setNetworkEvents] = useState<NetworkEvent[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

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
  }, [isRecording]);

  const contextValue = {
    networkEvents,
    isRecording,
    startRecording: () => {
      setNetworkEvents([]);
      setIsRecording(true);
    },
    stopRecording: () => {
      setIsRecording(false);
    },
    clearEvents: () => {
      setNetworkEvents([]);
    },
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      <div>
        <div style={{ position: "fixed", top: "10px", left: "250px", background: "rgba(0, 0, 0, 0.9)", color: "white", padding: "12px", borderRadius: "8px", fontSize: "12px", fontFamily: "monospace", zIndex: 1000, minWidth: "200px" }}>
          <div style={{ marginBottom: "8px", fontWeight: "bold" }}>Network Recording</div>
          <div style={{ marginBottom: "8px" }}>
            <button onClick={isRecording ? contextValue.stopRecording : contextValue.startRecording} style={{ background: isRecording ? "#ff4444" : "#2196F3", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", marginRight: "8px", fontSize: "11px" }}>
              {isRecording ? "Stop" : "Start"} Recording
            </button>
            <button onClick={contextValue.clearEvents} style={{ background: "#666", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>
              Clear ({networkEvents.length})
            </button>
          </div>
          {isRecording && <div style={{ color: "#2196F3" }}>● Recording network...</div>}
        </div>

        {networkEvents.length > 0 && (
          <div style={{ position: "fixed", bottom: "10px", left: "10px", right: "10px", maxHeight: "200px", background: "rgba(0, 0, 0, 0.9)", color: "white", padding: "10px", borderRadius: "4px", fontSize: "11px", fontFamily: "monospace", overflow: "auto", zIndex: 999 }}>
            <div><strong>Network Events Log:</strong></div>
            {networkEvents.map((event, index) => (
              <div key={index} style={{ marginBottom: "5px" }}>
                {event.type === "network-request" ? (
                  <span style={{ color: "#87CEEB" }}>→ {event.method} {event.url}</span>
                ) : (
                  <span style={{ color: "#90EE90" }}>← {event.status} (Response)</span>
                )}
                <span style={{ color: "#ddd", marginLeft: "10px" }}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {children}
      </div>
    </NetworkContext.Provider>
  );
}

export default NetworkInterceptor;

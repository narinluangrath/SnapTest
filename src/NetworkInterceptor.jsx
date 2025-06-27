import { useEffect, useState, createContext, useContext } from 'react'

// Context to share network events across components
const NetworkContext = createContext()

export const useNetworkEvents = () => {
  const context = useContext(NetworkContext)
  if (!context) {
    throw new Error('useNetworkEvents must be used within a NetworkInterceptor')
  }
  return context
}

function NetworkInterceptor({ children }) {
  const [networkEvents, setNetworkEvents] = useState([])
  const [isRecording, setIsRecording] = useState(false)

  useEffect(() => {
    if (!isRecording) return

    // Store original fetch
    const originalFetch = window.fetch

    // Override fetch to intercept requests
    window.fetch = async (...args) => {
      const requestId = crypto.randomUUID()
      const [resource, config] = args
      
      // Create request object for logging
      const url = typeof resource === 'string' ? resource : resource.url
      const method = config?.method || 'GET'
      
      const requestEvent = {
        id: requestId,
        type: 'network-request',
        method,
        url,
        timestamp: Date.now(),
        request: {
          headers: config?.headers || {},
          body: config?.body || null
        }
      }

      setNetworkEvents(prev => [...prev, requestEvent])

      try {
        // Make the actual request
        const response = await originalFetch(...args)
        
        // Clone response to read body without consuming it
        const responseClone = response.clone()
        
        try {
          const responseText = await responseClone.text()
          let responseData
          try {
            responseData = JSON.parse(responseText)
          } catch {
            responseData = responseText
          }

          const responseEvent = {
            id: requestId,
            type: 'network-response',
            status: response.status,
            url,
            timestamp: Date.now(),
            response: {
              headers: Object.fromEntries(response.headers.entries()),
              data: responseData
            }
          }

          setNetworkEvents(prev => [...prev, responseEvent])
        } catch (error) {
          console.log('Error reading response:', error)
        }

        return response
      } catch (error) {
        const errorEvent = {
          id: requestId,
          type: 'network-error',
          url,
          timestamp: Date.now(),
          error: error.message
        }

        setNetworkEvents(prev => [...prev, errorEvent])
        throw error
      }
    }

    // Cleanup function to restore original fetch
    return () => {
      window.fetch = originalFetch
    }
  }, [isRecording])

  const startRecording = () => {
    setNetworkEvents([])
    setIsRecording(true)
  }

  const stopRecording = () => {
    setIsRecording(false)
  }

  const clearEvents = () => {
    setNetworkEvents([])
  }

  const contextValue = {
    networkEvents,
    isRecording,
    startRecording,
    stopRecording,
    clearEvents
  }

  return (
    <NetworkContext.Provider value={contextValue}>
      <div>
        {/* Recording controls */}
        <div style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          background: 'rgba(0, 0, 255, 0.9)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          <div>Network Recording: {isRecording ? 'ON' : 'OFF'}</div>
          <div>Events: {networkEvents.length}</div>
          <div style={{ marginTop: '5px' }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              style={{
                marginRight: '5px',
                padding: '2px 6px',
                fontSize: '10px'
              }}
            >
              {isRecording ? 'Stop' : 'Start'}
            </button>
            <button
              onClick={clearEvents}
              style={{
                padding: '2px 6px',
                fontSize: '10px'
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Network events log */}
        {networkEvents.length > 0 && (
          <div style={{
            position: 'fixed',
            bottom: '10px',
            left: '10px',
            right: '10px',
            maxHeight: '200px',
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'monospace',
            overflow: 'auto',
            zIndex: 999
          }}>
            <div><strong>Network Events Log:</strong></div>
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

        {children}
      </div>
    </NetworkContext.Provider>
  )
}

export default NetworkInterceptor
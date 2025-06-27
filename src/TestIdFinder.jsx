import { useState, useEffect, useRef } from 'react'

function TestIdFinder({ children }) {
  const [highlightedElement, setHighlightedElement] = useState(null)
  const containerRef = useRef(null)

  const findClosestTestId = (element) => {
    let current = element
    while (current && current !== document.body) {
      if (current.getAttribute && current.getAttribute('data-test-id')) {
        return current
      }
      current = current.parentElement
    }
    return null
  }

  const handleMouseMove = (event) => {
    const target = event.target
    const elementWithTestId = findClosestTestId(target)
    
    if (elementWithTestId !== highlightedElement) {
      if (highlightedElement) {
        highlightedElement.style.outline = ''
        highlightedElement.style.outlineOffset = ''
      }
      
      if (elementWithTestId) {
        elementWithTestId.style.outline = '2px solid red'
        elementWithTestId.style.outlineOffset = '2px'
      }
      
      setHighlightedElement(elementWithTestId)
    }
  }

  const handleMouseLeave = () => {
    if (highlightedElement) {
      highlightedElement.style.outline = ''
      highlightedElement.style.outlineOffset = ''
      setHighlightedElement(null)
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove)
      container.addEventListener('mouseleave', handleMouseLeave)
      
      return () => {
        container.removeEventListener('mousemove', handleMouseMove)
        container.removeEventListener('mouseleave', handleMouseLeave)
        if (highlightedElement) {
          highlightedElement.style.outline = ''
          highlightedElement.style.outlineOffset = ''
        }
      }
    }
  }, [highlightedElement])

  return (
    <div ref={containerRef} style={{ minHeight: '100vh' }}>
      {children}
      {highlightedElement && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'rgba(255, 0, 0, 0.9)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          zIndex: 1000,
          pointerEvents: 'none',
          maxWidth: '300px',
          wordBreak: 'break-word'
        }}>
          <div>data-test-id: {highlightedElement.getAttribute('data-test-id')}</div>
          {(() => {
            const text = highlightedElement.innerText?.trim()
            if (text && text.length > 0) {
              const truncatedText = text.length > 100 ? text.substring(0, 100) + '...' : text
              return <div style={{ marginTop: '4px', opacity: 0.9 }}>text: "{truncatedText}"</div>
            }
            return null
          })()}
        </div>
      )}
    </div>
  )
}

export default TestIdFinder
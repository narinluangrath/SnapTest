import { setupWorker } from 'npm:msw@^2.0.0/browser'
import { handlers } from './handlers.js'

// This configures a Service Worker with the given request handlers.
export const worker = setupWorker(...handlers)
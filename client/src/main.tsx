import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './lib/accentColors' // apply saved accent color on load
import App from './App'
import { GlobalRequestIndicator } from './components/GlobalRequestIndicator'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <GlobalRequestIndicator />
    </QueryClientProvider>
  </StrictMode>,
)

import './App.css'
import MainLayout from './components/MainLayout'
import CommandPalette from './shell/CommandPalette'
import CellPanelHost from './components/CellPanelHost'
import { ConsoleProvider } from './context/ConsoleContext'
import { InspectorProvider } from './context/InspectorContext'

// The session cookie is minted by the toolbar's connection check
// (hooks/useConnection), which hits /api/session on mount and every 5s.
// Selection inspectors are app-wide: opened from a grid, floating over the
// app, minimized onto the steps bar.
function App() {
  return (
    <ConsoleProvider>
      <InspectorProvider>
        <MainLayout />
        <CommandPalette />
        <CellPanelHost />
      </InspectorProvider>
    </ConsoleProvider>
  )
}

export default App

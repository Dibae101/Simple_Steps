import './App.css'
import MainLayout from './components/MainLayout'
import CommandPalette from './shell/CommandPalette'
import CellPanelHost from './components/CellPanelHost'
import { ConsoleProvider } from './context/ConsoleContext'

// The session cookie is minted by the toolbar's connection check
// (hooks/useConnection), which hits /api/session on mount and every 5s.
function App() {
  return (
    <ConsoleProvider>
      <MainLayout />
      <CommandPalette />
      <CellPanelHost />
    </ConsoleProvider>
  )
}

export default App

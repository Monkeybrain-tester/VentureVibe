import MapPage from './pages/MapPage';
import AuthPage from './pages/AuthPage';
import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from './AuthContext'

function App() {
  const { user } = useAuth()

  if (!user) {
    return <AuthPage />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapPage />}/>
      </Routes>
    </BrowserRouter>
  )
}

export default App

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from './components/auth/AuthGuard'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { SearchPage } from './pages/SearchPage'
import { SavedPage } from './pages/SavedPage'
import { TrashPage } from './pages/TrashPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/search"
          element={
            <AuthGuard>
              <SearchPage />
            </AuthGuard>
          }
        />
        <Route
          path="/saved"
          element={
            <AuthGuard>
              <SavedPage />
            </AuthGuard>
          }
        />
        <Route
          path="/trash"
          element={
            <AuthGuard>
              <TrashPage />
            </AuthGuard>
          }
        />
        <Route path="/" element={<Navigate to="/search" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

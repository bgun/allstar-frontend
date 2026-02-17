import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xl font-bold text-gray-900">Allstar AI</Link>
              <div className="flex gap-4">
                <Link
                  to="/"
                  className={`text-sm ${location.pathname === '/' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Listings
                </Link>
                <Link
                  to="/dashboard"
                  className={`text-sm ${location.pathname === '/dashboard' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Dashboard
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user?.email}</span>
              <button
                onClick={signOut}
                className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

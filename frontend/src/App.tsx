import { SignIn, SignUp } from '@clerk/clerk-react'
import { useLocation, Link } from 'react-router-dom'
import './App.css'

function App() {
  const location = useLocation();
  
  // Determine which auth view to show based on current path
  const isSignUpPage = location.pathname === '/sign-up';

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#171717]">Seer App</h1>
          <p className="text-gray-600 mt-2">
            {isSignUpPage ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {isSignUpPage ? (
          <>
            <SignUp redirectUrl="/api/auth" />
            <div className="mt-6 text-center">
              <Link to="/sign-in" className="text-sm text-blue-600 hover:text-blue-800">
                Already have an account? Sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <SignIn redirectUrl="/api/auth" />
            <div className="mt-6 text-center">
              <Link to="/sign-up" className="text-sm text-blue-600 hover:text-blue-800">
                Don't have an account? Sign up
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App

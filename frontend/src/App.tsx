import { SignIn, SignUp } from '@clerk/clerk-react'
import { useLocation } from 'react-router-dom'
import './App.css'

function App() {
  const location = useLocation();
  
  // Determine which auth view to show based on current path
  const isSignUpPage = location.pathname === '/sign-up';

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="max-w-md w-full p-8 bg-white rounded-lg">

        {isSignUpPage ? (
          <>
            <SignUp redirectUrl="/api/auth" />
          </>
        ) : (
          <>
            <SignIn redirectUrl="/api/auth" />
          </>
        )}
      </div>
    </div>
  )
}

export default App

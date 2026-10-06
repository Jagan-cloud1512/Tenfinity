import { lazy, Suspense, Component, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';

const TopicSelection = lazy(() => import('./pages/TopicSelection'));
const Chat = lazy(() => import('./pages/Chat'));
const Assessment = lazy(() => import('./pages/Assessment'));
const CodingAssessment = lazy(() => import('./pages/CodingAssessment'));
const Learning = lazy(() => import('./pages/Learning'));
const Results = lazy(() => import('./pages/Results'));
const FinalAssessment = lazy(() => import('./pages/FinalAssessment'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    </div>
  );
}

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center p-8">
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 max-w-lg">
            <h2 className="text-red-400 text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-4">{this.state.error.message}</p>
            <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-500">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function SmartRedirect() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/auth/progress', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        navigate(data?.route || '/topics', { replace: true });
      })
      .catch(() => {
        navigate('/topics', { replace: true });
      })
      .finally(() => setChecked(true));
  }, [session, navigate]);

  if (!checked) return <PageLoader />;
  return null;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  return user ? <SmartRedirect /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/topics" element={<ProtectedRoute><TopicSelection /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/assessment" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
            <Route path="/coding-assessment" element={<ProtectedRoute><CodingAssessment /></ProtectedRoute>} />
            <Route path="/learning" element={<ProtectedRoute><Learning /></ProtectedRoute>} />
            <Route path="/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
            <Route path="/final-assessment" element={<ProtectedRoute><FinalAssessment /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><SmartRedirect /></ProtectedRoute>} />
            <Route path="*" element={<ProtectedRoute><SmartRedirect /></ProtectedRoute>} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

import { useState } from 'react';
import { Eye, EyeOff, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import * as api from '../api';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.login(password, rememberMe);
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mx-auto mb-4 sm:mb-5">
            <img
              src="/logo.svg"
              alt="S3 Explorer"
              className="w-14 h-14 sm:w-16 sm:h-16 logo-themed"
            />
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-foreground">
            {showForgot ? 'Forgot Password' : 'Welcome back'}
          </h1>
          <p className="text-sm text-foreground-muted mt-1.5 sm:mt-2">
            {showForgot ? 'How to reset your password' : 'Enter your password to continue'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-background-secondary border border-border rounded-lg p-4 sm:p-5">
          {showForgot ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground-secondary leading-relaxed">
                Your password was set via the <code className="text-xs bg-background-tertiary px-1.5 py-0.5 rounded font-mono">APP_PASSWORD</code> environment variable or the setup wizard. To reset it, set <code className="text-xs bg-background-tertiary px-1.5 py-0.5 rounded font-mono">APP_PASSWORD</code> and restart the server.
              </p>
              <button
                onClick={() => setShowForgot(false)}
                className="w-full py-3 px-4 rounded-md bg-accent-purple text-white hover:brightness-110 transition-all text-sm font-medium"
              >
                Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm text-foreground-secondary">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10 font-mono h-10 text-sm"
                    placeholder="Enter password"
                    required
                    autoFocus
                    autoComplete="current-password"
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-foreground-muted hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group py-1">
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${rememberMe
                      ? 'bg-accent-purple border-accent-purple'
                      : 'border-border bg-transparent group-hover:border-border-hover'
                    }`}
                  aria-hidden="true"
                >
                  {rememberMe && <Check className="w-3 h-3 text-white" aria-hidden="true" />}
                </span>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                  aria-label="Remember me for 7 days"
                />
                <span className="text-sm text-foreground-secondary group-hover:text-foreground transition-colors">Remember me</span>
              </label>

              {error && (
                <div id="login-error" className="p-3 rounded-md bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-3 px-4 rounded-md bg-accent-purple text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="w-full text-sm text-foreground-muted hover:text-foreground transition-colors py-1"
              >
                Forgot password?
              </button>
            </form>
          )}
        </div>

      </div>

      {/* GitHub link */}
      <a
        href="https://github.com/subratomandal"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 w-4 h-4 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity duration-200"
        aria-label="Visit GitHub (opens in new tab)"
      >
        <GithubIcon className="w-4 h-4" />
      </a>
    </div>
  );
}

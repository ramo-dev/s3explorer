import { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Field, FieldError, FieldLabel } from './ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from './ui/input-group';
import { Spinner } from './ui/spinner';
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
        <Card>
          <CardContent>
            {showForgot ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your password was set via the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">APP_PASSWORD</code> environment variable or the setup wizard. To reset it, set <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">APP_PASSWORD</code> and restart the server.
                </p>
                <Button className="w-full" onClick={() => setShowForgot(false)}>
                  Back to login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <InputGroup className="h-10">
                    <InputGroupInput
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="font-mono"
                      placeholder="Enter password"
                      required
                      autoFocus
                      autoComplete="current-password"
                      aria-describedby={error ? 'login-error' : undefined}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {error && (
                    <FieldError id="login-error" className="text-destructive">
                      {error}
                    </FieldError>
                  )}
                </Field>

                <Field orientation="horizontal">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={setRememberMe}
                  />
                  <FieldLabel htmlFor="remember">
                    Remember me
                    <span className="text-muted-foreground font-normal"> for 7 days</span>
                  </FieldLabel>
                </Field>

                <Button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Spinner aria-label="Signing in" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight aria-hidden="true" />
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowForgot(true)}
                  className="w-full"
                >
                  Forgot password?
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
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

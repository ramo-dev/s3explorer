import { useState } from 'react';
import { ArrowRight, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import * as api from '../api';

interface SetupPageProps {
    onSetupComplete: () => void;
}

export function SetupPage({ onSetupComplete }: SetupPageProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [sessionSecret, setSessionSecret] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showSecret, setShowSecret] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 12) {
            setError('Password must be at least 12 characters');
            return;
        }

        try {
            setLoading(true);
            // Send both password and optional session secret
            await api.setup(password, sessionSecret || undefined);
            onSetupComplete();
        } catch (err: any) {
            setError(err.message || 'Setup failed');
        } finally {
            setLoading(false);
        }
    };

    const requirements = [
        { label: 'At least 12 characters', valid: password.length >= 12 },
        { label: 'Lowercase letter', valid: /[a-z]/.test(password) },
        { label: 'Uppercase letter', valid: /[A-Z]/.test(password) },
        { label: 'Number', valid: /[0-9]/.test(password) },
        { label: 'Special character', valid: /[^a-zA-Z0-9]/.test(password) },
    ];

    return (
        <div className="min-h-dvh flex flex-col items-center bg-background px-4 py-8 sm:px-6 lg:px-8 overflow-y-auto">

            <div className="flex-1 w-full flex flex-col items-center justify-center max-w-md space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="mx-auto w-16 h-16 flex items-center justify-center mb-6">
                        <img src="/logo.svg" alt="S3 Explorer" className="w-16 h-16 logo-themed" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome to S3 Explorer</h1>
                    <p className="text-foreground-secondary">
                        Configure your instance security settings.
                    </p>
                </div>

                {/* Card */}
                <div className="w-full bg-background-secondary p-5 sm:p-6 rounded-lg border border-border">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Session Secret Section */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium" htmlFor="session-secret">
                                Session Secret
                            </label>
                            <p className="text-xs text-foreground-muted mb-2">
                                Set a persistent secret to keep users logged in. 32+ character string (use <code>openssl rand -hex 32</code>) preferred.
                            </p>
                            <div className="relative">
                                <input
                                    id="session-secret"
                                    type={showSecret ? "text" : "password"}
                                    value={sessionSecret}
                                    onChange={(e) => setSessionSecret(e.target.value)}
                                    className="input w-full h-10 text-sm pr-10 rounded-md"
                                    placeholder="Enter a 32+ char secret..."
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSecret(!showSecret)}
                                    aria-label={showSecret ? 'Hide session secret' : 'Show session secret'}
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-foreground-muted hover:text-foreground transition-colors"
                                >
                                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Session Secret Requirements */}
                        <div className="space-y-2 bg-background/50 p-4 rounded-md border border-dashed border-border">
                            <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider block mb-2">
                                Session Secret Requirements
                            </span>
                            <div className="grid grid-cols-1 gap-1.5">
                                {[
                                    { label: 'At least 32 characters', valid: sessionSecret.length >= 32 },
                                ].map((req, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${req.valid ? 'bg-accent-green/20 text-accent-green' : 'bg-background-tertiary text-foreground-muted'
                                            }`}>
                                            {req.valid && <Check className="w-2.5 h-2.5" />}
                                        </div>
                                        <span className={req.valid ? 'text-foreground' : 'text-foreground-secondary'}>
                                            {req.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Password Inputs */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5" htmlFor="password">
                                    Admin Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="input w-full h-10 text-sm pr-10 rounded-md"
                                        placeholder="Create a strong password..."
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute inset-y-0 right-0 px-3 flex items-center text-foreground-muted hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5" htmlFor="confirm-password">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="confirm-password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="input w-full h-10 text-sm pr-10 rounded-md"
                                        placeholder="Repeat password..."
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                        className="absolute inset-y-0 right-0 px-3 flex items-center text-foreground-muted hover:text-foreground transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Password Requirements */}
                        <div className="space-y-2 bg-background/50 p-4 rounded-md border border-dashed border-border">
                            <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider block mb-2">
                                Password Requirements
                            </span>
                            <div className="grid grid-cols-1 gap-1.5">
                                {requirements.map((req, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${req.valid ? 'bg-accent-green/20 text-accent-green' : 'bg-background-tertiary text-foreground-muted'
                                            }`}>
                                            {req.valid && <Check className="w-2.5 h-2.5" />}
                                        </div>
                                        <span className={req.valid ? 'text-foreground' : 'text-foreground-secondary'}>
                                            {req.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-md bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm flex items-center gap-2" role="alert">
                                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || requirements.some(r => !r.valid) || password !== confirmPassword || !sessionSecret || sessionSecret.length < 32}
                            className="w-full py-3 px-4 rounded-md bg-accent-purple text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Configuring...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    Complete Setup
                                    <ArrowRight className="w-4 h-4" />
                                </span>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-foreground-muted">
                    Secrets are encrypted and stored securely using SQLite + Argon2.
                </p>
            </div>

            {/* Footer - Pushed to bottom via flex layout */}
            <div className="mt-8 py-4 opacity-50 hover:opacity-100 transition-opacity duration-200">
                <a
                    href="https://github.com/subratomandal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
                >
                    <GithubIcon className="w-5 h-5" />
                </a>
            </div>
        </div>
    );
}

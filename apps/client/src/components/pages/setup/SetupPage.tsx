import { AlertCircle, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { useSetup } from '@/api/queries';
import { GithubIcon } from '@/components/icons/GithubIcon';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

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

    const setupMutation = useSetup();
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (setupMutation.isPending) return;
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
            // Send both password and optional session secret
            await setupMutation.mutateAsync({ password, sessionSecret: sessionSecret || undefined });
            onSetupComplete();
        } catch (err: any) {
            setError(err.message || 'Setup failed');
        }
    };

    const passwordRequirements = [
        { label: 'At least 12 characters', valid: password.length >= 12 },
        { label: 'Lowercase letter', valid: /[a-z]/.test(password) },
        { label: 'Uppercase letter', valid: /[A-Z]/.test(password) },
        { label: 'Number', valid: /[0-9]/.test(password) },
        { label: 'Special character', valid: /[^a-zA-Z0-9]/.test(password) },
    ];

    const secretRequirements = [
        { label: 'At least 32 characters', valid: sessionSecret.length >= 32 },
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
                    <p className="text-muted-foreground">
                        Configure your instance security settings.
                    </p>
                </div>

                {/* Card */}
                <Card>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* Session Secret Section */}
                            <PasswordInput
                                id="session-secret"
                                label="Session Secret"
                                description={<>Set a persistent secret to keep users logged in. 32+ character string (use <code>openssl rand -hex 32</code>) preferred.</>}
                                value={sessionSecret}
                                onChange={setSessionSecret}
                                revealed={showSecret}
                                onToggleRevealed={() => setShowSecret(!showSecret)}
                                placeholder="Enter a 32+ char secret..."
                                autoFocus
                            />

                            {/* Session Secret Requirements */}
                            <RequirementList title="Session Secret Requirements" requirements={secretRequirements} />

                            {/* Password Inputs */}
                            <PasswordInput
                                id="password"
                                label="Admin Password"
                                value={password}
                                onChange={setPassword}
                                revealed={showPassword}
                                onToggleRevealed={() => setShowPassword(!showPassword)}
                                placeholder="Create a strong password..."
                            />

                            <PasswordInput
                                id="confirm-password"
                                label="Confirm Password"
                                value={confirmPassword}
                                onChange={setConfirmPassword}
                                revealed={showConfirmPassword}
                                onToggleRevealed={() => setShowConfirmPassword(!showConfirmPassword)}
                                placeholder="Repeat password..."
                            />

                            {/* Password Requirements */}
                            <RequirementList title="Password Requirements" requirements={passwordRequirements} />

                        {error && (
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2" role="alert">
                                <AlertCircle className="shrink-0" aria-hidden="true" />
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={setupMutation.isPending || passwordRequirements.some(r => !r.valid) || password !== confirmPassword || !sessionSecret || sessionSecret.length < 32}
                            className="w-full"
                        >
                            {setupMutation.isPending ? (
                                <>
                                    <Spinner aria-label="Configuring" />
                                    Configuring...
                                </>
                            ) : (
                                <>
                                    Complete Setup
                                    <ArrowRight aria-hidden="true" />
                                </>
                            )}
                        </Button>
                        </form>
                    </CardContent>
                </Card>

                <p className="text-center text-sm text-muted-foreground">
                    Secrets are encrypted and stored securely using SQLite + Argon2.
                </p>
            </div>

            {/* Footer - Pushed to bottom via flex layout */}
            <div className="mt-8 py-4 opacity-50 hover:opacity-100 transition-opacity duration-200">
                <a
                    href="https://github.com/subratomandal"
                    aria-label="Open the project author’s GitHub profile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                    <GithubIcon className="w-5 h-5" />
                </a>
            </div>
        </div>
    );
}

interface Requirement {
    label: string;
    valid: boolean;
}

function RequirementList({ title, requirements }: { title: string; requirements: Requirement[] }) {
    return (
        <div className="space-y-2 bg-muted/50 p-4 rounded-md border border-dashed">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                {title}
            </span>
            <div className="grid grid-cols-1 gap-1.5">
                {requirements.map((req) => (
                    <div key={req.label} className="flex items-center gap-2 text-sm">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${req.valid ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                            }`}>
                            {req.valid && <Check className="size-2.5" aria-hidden="true" />}
                        </div>
                        <span className={req.valid ? 'text-foreground' : 'text-muted-foreground'}>
                            {req.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

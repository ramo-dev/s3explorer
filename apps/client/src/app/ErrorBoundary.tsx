import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../components/ui/button';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

// Must be a class component -- React only supports error boundaries via
// getDerivedStateFromError / componentDidCatch, and there's no hook equivalent.
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        // Log error for debugging (could be sent to error tracking service)
        console.error('React Error Boundary caught an error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
                    <div className="max-w-md w-full text-center space-y-6">
                        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-destructive/10">
                            <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-xl font-semibold text-foreground">
                                Something went wrong
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                The application encountered an unexpected error. This has been logged for investigation.
                            </p>
                        </div>

                        {this.state.error && (
                            <details className="rounded-lg bg-card p-4 text-left text-xs">
                                <summary className="mb-2 cursor-pointer font-medium text-muted-foreground">
                                    Error Details
                                </summary>
                                <pre className="overflow-auto whitespace-pre-wrap wrap-break-word text-destructive">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}

                        <div className="flex justify-center gap-3">
                            <Button onClick={this.handleReset} variant="secondary">
                                Try Again
                            </Button>
                            <Button onClick={this.handleReload} className="items-center gap-2">
                                <RefreshCw className="size-4" aria-hidden="true" />
                                Reload Page
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

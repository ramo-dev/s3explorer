import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { STORAGE_KEYS } from '../constants';

interface WelcomeMessageProps {
  onConfigure: () => void;
}

export function WelcomeMessage({ onConfigure }: WelcomeMessageProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed before
    const hasDismissed = localStorage.getItem(STORAGE_KEYS.WELCOME_DISMISSED);
    if (hasDismissed) {
      setDismissed(true);
      return;
    }

    // Delay showing the welcome toast so it doesn't flash briefly if the app
    // already has a saved connection and immediately starts loading data.
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Two-step dismiss: first fade out via opacity transition (300ms CSS
  // duration matches the class below), then remove from DOM after the
  // transition completes so the element doesn't linger invisibly.
  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEYS.WELCOME_DISMISSED, 'true');
    setTimeout(() => setDismissed(true), 300);
  };

  const handleConfigure = () => {
    handleDismiss();
    onConfigure();
  };

  if (dismissed) return null;

  return (
    <div
      className={`fixed bottom-3 sm:bottom-5 left-3 right-3 sm:left-auto sm:right-5 z-50 mb-safe sm:max-w-xs transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <div className="group relative rounded-lg border border-border bg-card p-3.5 shadow-xl transition-colors duration-200 hover:border-primary/50 hover:bg-muted">
        {/* The card is one big target, but the dismiss control inside it is a
            real button, so wrapping both in a button would nest interactive
            elements. Instead the action is a transparent button stretched over
            the whole card, and dismiss sits on top of it. Both are ordinary
            buttons, so both are real tab stops -- the card as a whole was
            previously reachable by mouse only. */}
        <button
          type="button"
          onClick={handleConfigure}
          className="absolute inset-0 z-0 cursor-pointer rounded-lg"
          aria-label="Configure your S3 connection"
        />

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 z-10 cursor-pointer p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dismiss welcome message"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
            <img
              src="/logo.svg"
              alt=""
              className="logo-themed size-6 opacity-80 transition-opacity group-hover:opacity-100"
            />
          </div>
          {/* Right padding keeps the title clear of the absolutely positioned dismiss button */}
          <div className="min-w-0 flex-1 pr-6">
            <h4 className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
              Welcome to S3 Explorer
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Click to configure your connection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

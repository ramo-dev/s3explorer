import { Eye, EyeOff } from 'lucide-react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Whether the value is currently revealed. Drives the toggle's label and icon. */
  revealed: boolean;
  onToggleRevealed: () => void;
  placeholder?: string;
  description?: React.ReactNode;
  error?: string;
  autoFocus?: boolean;
}

/**
 * Labelled password field with a reveal toggle.
 *
 * All three of SetupPage's secret fields were the same input-plus-absolutely-
 * positioned-button markup; InputGroup already handles the border, focus ring
 * and addon alignment, so this only picks the right label and toggle state.
 */
export function PasswordInput({
  id,
  label,
  value,
  onChange,
  revealed,
  onToggleRevealed,
  placeholder,
  description,
  error,
  autoFocus,
}: PasswordInputProps) {
  const errorId = `${id}-error`;

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
      <InputGroup className="h-10">
        <InputGroupInput
          id={id}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          autoFocus={autoFocus}
          aria-describedby={error ? errorId : undefined}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            onClick={onToggleRevealed}
            aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          >
            {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <FieldError id={errorId} className="text-destructive">
          {error}
        </FieldError>
      )}
    </Field>
  );
}

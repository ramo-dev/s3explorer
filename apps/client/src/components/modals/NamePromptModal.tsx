import { useId, useState } from 'react';
import { Button } from '../ui/button';
import { Field, FieldError, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { Modal } from '../Modal';

interface NamePromptModalProps {
    title: string;
    label: string;
    placeholder: string;
    /** Null while closed. */
    isOpen: boolean;
    value: string;
    onChange: (value: string) => void;
    onClose: () => void;
    onSubmit: () => Promise<void> | void;
    validate: (value: string) => { valid: boolean; error?: string };
    maxLength: number;
    submitLabel: string;
    pendingLabel: string;
    /** Always shown beneath the field while there is no error. */
    hint?: string;
    /** Above this length, show a running character count instead. */
    characterLimit?: number;
    inputProps?: React.ComponentProps<typeof Input>;
    normalize?: (value: string) => string;
}

// Rename, Create Folder and Create Bucket were three near-identical files:
// label, input, error or hint, Cancel and Submit. They differ only in copy,
// validation and a couple of input attributes, so the shape lives here once.
export function NamePromptModal({
    title,
    label,
    placeholder,
    isOpen,
    value,
    onChange,
    onClose,
    onSubmit,
    validate,
    maxLength,
    submitLabel,
    pendingLabel,
    hint,
    characterLimit,
    inputProps,
    normalize,
}: NamePromptModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [touched, setTouched] = useState(false);
    const inputId = useId();
    const hintId = useId();
    const errorId = useId();
    const countId = useId();

    const validation = validate(value);
    const showError = touched && !validation.valid && !!value.trim();
    // Only once the name is long enough to plausibly be truncated.
    const showCount = characterLimit !== undefined && value.length > characterLimit;
    // Exactly one of these is rendered, so describe whichever one it is.
    const descriptionId = showError ? errorId : hint ? hintId : showCount ? countId : undefined;

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setTouched(true);
        if (isSubmitting || !validation.valid) return;
        setIsSubmitting(true);
        try {
            await onSubmit();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setTouched(false);
        onClose();
    };

    return (
        <Modal title={title} onClose={handleClose}>
            <form
                className="space-y-4"
                onSubmit={e => {
                    e.preventDefault();
                    handleSubmit();
                }}
            >
                <Field className="gap-1.5">
                    <FieldLabel htmlFor={inputId} className="text-sm text-muted-foreground">
                        {label}
                    </FieldLabel>
                    <Input
                        id={inputId}
                        type="text"
                        placeholder={placeholder}
                        value={value}
                        onChange={e => onChange(normalize ? normalize(e.target.value) : e.target.value)}
                        onBlur={() => setTouched(true)}
                        // Input styles its error state from aria-invalid, so the
                        // old conditional border/focus overrides are unneeded.
                        aria-invalid={showError || undefined}
                        aria-describedby={descriptionId}
                        autoFocus
                        autoComplete="off"
                        spellCheck="false"
                        enterKeyHint="done"
                        disabled={isSubmitting}
                        maxLength={maxLength}
                        {...inputProps}
                    />
                    {showError ? (
                        <FieldError id={errorId}>{validation.error}</FieldError>
                    ) : hint ? (
                        <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
                    ) : showCount ? (
                        <p id={countId} className="text-xs text-muted-foreground tabular-nums">
                            {value.length}/{maxLength}
                        </p>
                    ) : null}
                </Field>
                <div className="flex justify-end gap-3">
                    <Button type="button" variant="secondary" disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={!validation.valid || isSubmitting}>
                        {isSubmitting ? pendingLabel : submitLabel}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

import { validateFileName } from '@/lib/validation';
import { NamePromptModal } from './NamePromptModal';

interface RenameModalProps {
    isOpen: boolean;
    value: string;
    onChange: (value: string) => void;
    onClose: () => void;
    onRename: () => Promise<void> | void;
}

export function RenameModal({ isOpen, value, onChange, onClose, onRename }: RenameModalProps) {
    return (
        <NamePromptModal
            title="Rename"
            label="New Name"
            placeholder="Enter new name…"
            isOpen={isOpen}
            value={value}
            onChange={onChange}
            onClose={onClose}
            onSubmit={onRename}
            validate={validateFileName}
            maxLength={255}
            submitLabel="Rename"
            pendingLabel="Renaming…"
            // Beyond this length the name is very likely truncated, so count up.
            characterLimit={50}
        />
    );
}

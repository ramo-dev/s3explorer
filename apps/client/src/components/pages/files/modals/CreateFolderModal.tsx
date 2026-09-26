import { validateFolderName } from '@/lib/validation';
import { NamePromptModal } from './NamePromptModal';

interface CreateFolderModalProps {
    isOpen: boolean;
    value: string;
    onChange: (value: string) => void;
    onClose: () => void;
    onCreate: () => Promise<void> | void;
}

export function CreateFolderModal({ isOpen, value, onChange, onClose, onCreate }: CreateFolderModalProps) {
    return (
        <NamePromptModal
            title="Create Folder"
            label="Folder Name"
            placeholder="e.g. vacation"
            isOpen={isOpen}
            value={value}
            onChange={onChange}
            onClose={onClose}
            onSubmit={onCreate}
            validate={validateFolderName}
            maxLength={255}
            submitLabel="Create"
            pendingLabel="Creating…"
        />
    );
}

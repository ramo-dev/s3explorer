import { validateBucketName } from '../../utils/validation';
import { NamePromptModal } from './NamePromptModal';

interface CreateBucketModalProps {
    isOpen: boolean;
    value: string;
    onChange: (value: string) => void;
    onClose: () => void;
    onCreate: () => Promise<void> | void;
}

export function CreateBucketModal({ isOpen, value, onChange, onClose, onCreate }: CreateBucketModalProps) {
    return (
        <NamePromptModal
            title="Create Bucket"
            label="Bucket Name"
            placeholder="e.g. my-bucket"
            isOpen={isOpen}
            value={value}
            onChange={onChange}
            onClose={onClose}
            onSubmit={onCreate}
            validate={validateBucketName}
            maxLength={63}
            submitLabel="Create"
            pendingLabel="Creating…"
            hint="3–63 characters: lowercase letters, numbers, and hyphens"
            normalize={v => v.toLowerCase()}
        />
    );
}

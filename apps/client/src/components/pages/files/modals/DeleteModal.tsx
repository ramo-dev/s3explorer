import { useState } from 'react';
import type { S3Object } from '@/types';
import { getFileName } from '@/lib/fileUtils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';

interface DeleteModalProps {
    object: S3Object | null;
    onClose: () => void;
    onDelete: () => Promise<void> | void;
}

// A destructive confirmation, so this is an AlertDialog rather than a Dialog.
// That is not only semantic: the previous version closed on any click on the
// backdrop, so a stray click while reaching for the mouse dismissed the
// confirmation. AlertDialog is modal by default and does not dismiss on
// outside press.
export function DeleteModal({ object, onClose, onDelete }: DeleteModalProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await onDelete();
        } finally {
            setIsDeleting(false);
        }
    };

    const fileName = object ? getFileName(object.key) : '';
    const isFolder = object?.isFolder ?? false;

    return (
        <AlertDialog open={!!object} onOpenChange={(open) => { if (!open) onClose(); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Delete {isFolder ? 'Folder' : 'File'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete{' '}
                        <span className="text-foreground font-medium">&quot;{fileName}&quot;</span>?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting} className="flex-1">
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        variant="destructive"
                        className="flex-1"
                    >
                        {isDeleting ? (
                            <>
                                <Spinner aria-hidden="true" />
                                Deleting...
                            </>
                        ) : (
                            'Delete'
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

import { createBucket, deleteBucket } from '@/api/buckets';
import type { Bucket, S3Object } from '@/types';

type Toast = (message: string, type?: 'success' | 'error') => void;

export function useBucketActions(options: {
  buckets: Bucket[];
  selectedBucket: string | null;
  newName: string;
  setBuckets: React.Dispatch<React.SetStateAction<Bucket[]>>;
  setSelectedBucket: (bucket: string | null) => void;
  setCurrentPath: (path: string) => void;
  setObjects: React.Dispatch<React.SetStateAction<S3Object[]>>;
  setNewName: (name: string) => void;
  setSearchQuery: (query: string) => void;
  setShowNewBucket: (open: boolean) => void;
  showToast: Toast;
  loadActiveConnection: () => void;
}) {
  const {
    buckets, selectedBucket, newName, setBuckets, setSelectedBucket,
    setCurrentPath, setObjects, setNewName, setSearchQuery, setShowNewBucket, showToast,
    loadActiveConnection,
  } = options;

  const handleCreateBucket = async () => {
    if (!newName.trim()) return;
    const name = newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existingBucketNames = new Set(buckets.map(bucket => bucket.name.toLowerCase()));
    if (existingBucketNames.has(name)) {
      showToast(`Bucket "${name}" already exists`, 'error');
      return;
    }

    const newBucket: Bucket = { name, creationDate: new Date().toISOString() };
    setBuckets(previous => [...previous, newBucket].sort((a, b) => a.name.localeCompare(b.name)));
    setShowNewBucket(false);
    setNewName('');
    try {
      await createBucket(name);
      setSelectedBucket(name);
      showToast(`Bucket "${name}" created`);
    } catch (err: any) {
      setBuckets(previous => previous.filter(bucket => bucket.name !== name));
      setSelectedBucket(null);
      showToast(err.message || 'Failed to create bucket', 'error');
    }
  };

  const handleDeleteBucket = async (name: string) => {
    const previousBuckets = buckets;
    setBuckets(previous => previous.filter(bucket => bucket.name !== name));
    if (selectedBucket === name) {
      setSelectedBucket(null);
      setObjects([]);
      setCurrentPath('');
    }
    try {
      await deleteBucket(name);
      showToast('Bucket deleted');
    } catch (err: any) {
      setBuckets(previousBuckets);
      showToast(err.message || 'Failed to delete bucket', 'error');
    }
  };

  const handleConnectionChange = () => {
    setSelectedBucket(null);
    setCurrentPath('');
    setObjects([]);
    setSearchQuery('');
    setNewName('');
    loadActiveConnection();
  };

  return { handleCreateBucket, handleDeleteBucket, handleConnectionChange };
}

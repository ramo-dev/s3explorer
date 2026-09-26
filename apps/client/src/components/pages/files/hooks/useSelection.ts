import { useCallback, useEffect, useState, type MutableRefObject } from 'react';

interface UseSelectionOptions {
  bucket: string | null;
  path: string;
  visibleObjectKeys: MutableRefObject<string[]>;
}

export function useSelection({ bucket, path, visibleObjectKeys }: UseSelectionOptions) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const select = useCallback((key: string, selected: boolean) => {
    setSelectedKeys(previous => {
      const next = new Set(previous);
      selected ? next.add(key) : next.delete(key);
      return next;
    });
  }, []);

  const selectAll = useCallback((selected: boolean) => {
    setSelectedKeys(selected ? new Set(visibleObjectKeys.current) : new Set());
  }, [visibleObjectKeys]);

  const selectRange = useCallback((keys: string[]) => {
    setSelectedKeys(previous => new Set([...previous, ...keys]));
  }, []);

  const clear = useCallback(() => setSelectedKeys(new Set()), []);

  useEffect(() => {
    clear();
  }, [bucket, path, clear]);

  return { selectedKeys, select, selectAll, selectRange, clear };
}

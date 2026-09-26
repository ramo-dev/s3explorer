import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/constants';

export function useViewPrefs() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  const toggleTheme = useCallback(() => setTheme(previous => previous === 'dark' ? 'light' : 'dark'), []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(sidebarCollapsed)), [sidebarCollapsed]);

  return { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, theme, toggleTheme };
}

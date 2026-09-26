import {
    Folder,
    File,
    Image,
    Film,
    Music,
    Archive,
    FileCode,
    FileText,
} from 'lucide-react';
import { getFileCategory } from './fileFilters';

export function getFileName(key: string): string {
    const parts = key.split('/').filter(Boolean);
    return parts[parts.length - 1] || key;
}

// "photos/2024/trip/" -> "photos/2024/", "photos/" -> ""
export function getParentPrefix(key: string): string {
    const parts = key.split('/').filter(Boolean);
    parts.pop();
    return parts.length ? parts.join('/') + '/' : '';
}

/**
 * Icon for a key.
 *
 * Built on getFileCategory rather than a second extension list, so a tile that
 * survives an "Images" filter is guaranteed to be wearing the image glyph. Two
 * lists would drift, and the mismatch reads as a bug.
 */
export function getFileIcon(key: string, isFolder: boolean) {
    switch (getFileCategory(key, isFolder)) {
        case 'folder':
            return <Folder className="w-5 h-5" />;
        case 'image':
            return <Image className="w-5 h-5" />;
        case 'video':
            return <Film className="w-5 h-5" />;
        case 'audio':
            return <Music className="w-5 h-5" />;
        case 'archive':
            return <Archive className="w-5 h-5" />;
        case 'code':
            return <FileCode className="w-5 h-5" />;
        case 'document':
            return <FileText className="w-5 h-5" />;
        case 'other':
            return <File className="w-5 h-5" />;
    }
}

// Preview support
export type PreviewType = 'image' | 'video' | 'audio' | 'text' | 'pdf' | null;

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac'];
const TEXT_EXTENSIONS = [
    'txt', 'md', 'json', 'yaml', 'yml', 'xml', 'csv', 'log', 'env', 'ini', 'cfg', 'conf',
    'js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'css', 'html', 'sql', 'sh', 'bash',
    'rb', 'php', 'c', 'cpp', 'h', 'hpp', 'toml', 'lock',
];

export function getPreviewType(key: string): PreviewType {
    const ext = key.split('.').pop()?.toLowerCase() || '';
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    if (TEXT_EXTENSIONS.includes(ext)) return 'text';
    if (ext === 'pdf') return 'pdf';
    return null;
}

export function isPreviewable(key: string): boolean {
    return getPreviewType(key) !== null;
}

// Programmatic <a download> click. Same-origin URLs served with
// Content-Disposition: attachment go straight to the browser's download UI.
export function triggerDownload(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

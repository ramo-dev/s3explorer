/**
 * Utility functions for generating unique file/folder names
 */

/**
 * Generate a unique name by appending (1), (2), etc. if the name already exists
 * @param baseName - The original name (e.g., "photo.jpg" or "folder")
 * @param existingNames - Set of names that already exist (case-insensitive comparison)
 * @param isFolder - Whether this is a folder (affects how extension is handled)
 * @returns A unique name
 */
export function generateUniqueName(
    baseName: string,
    existingNames: Set<string>,
    isFolder: boolean = false
): string {
    // S3 keys are technically case-sensitive, but users don't expect "Photo.jpg"
    // and "photo.jpg" to coexist in the same folder, so we compare case-insensitively.
    const existingNamesLower = new Set(
        Array.from(existingNames).map(n => n.toLowerCase())
    );

    // If name doesn't exist, return as-is
    if (!existingNamesLower.has(baseName.toLowerCase())) {
        return baseName;
    }

    // Split name and extension (for files)
    let nameWithoutExt: string;
    let ext: string;

    if (isFolder) {
        nameWithoutExt = baseName;
        ext = '';
    } else {
        const lastDot = baseName.lastIndexOf('.');
        if (lastDot > 0) {
            nameWithoutExt = baseName.substring(0, lastDot);
            ext = baseName.substring(lastDot);
        } else {
            nameWithoutExt = baseName;
            ext = '';
        }
    }

    // Strip an existing "(n)" suffix first so re-uploading "file (1).jpg" becomes
    // "file (2).jpg" instead of the ugly "file (1) (1).jpg".
    const suffixMatch = nameWithoutExt.match(/^(.+)\s*\((\d+)\)$/);
    if (suffixMatch) {
        nameWithoutExt = suffixMatch[1].trim();
    }

    // Find the next available number
    let counter = 1;
    let newName: string;

    do {
        newName = `${nameWithoutExt} (${counter})${ext}`;
        counter++;
    } while (existingNamesLower.has(newName.toLowerCase()) && counter < 1000);

    return newName;
}

/**
 * Process a list of files to upload, generating unique names for duplicates
 * @param files - Array of files to upload
 * @param existingNames - Set of names that already exist in the current folder
 * @returns Map of original file to new unique name
 */
export function resolveUploadConflicts(
    files: File[],
    existingNames: Set<string>
): Map<File, string> {
    const result = new Map<File, string>();
    // Tracks names we've already assigned in *this* batch. Without this, uploading
    // three copies of "photo.jpg" at once would all resolve to "photo (1).jpg".
    const usedNames = new Set(existingNames);

    for (const file of files) {
        const uniqueName = generateUniqueName(file.name, usedNames, false);
        result.set(file, uniqueName);
        usedNames.add(uniqueName.toLowerCase());
    }

    return result;
}

/**
 * Check if a name conflicts with existing objects
 * @param name - The name to check
 * @param existingNames - Set of existing names
 * @returns true if there's a conflict
 */
export function hasNameConflict(name: string, existingNames: Set<string>): boolean {
    const existingNamesLower = new Set(
        Array.from(existingNames).map(n => n.toLowerCase())
    );
    return existingNamesLower.has(name.toLowerCase());
}

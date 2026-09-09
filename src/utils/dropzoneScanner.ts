/**
 * Dropzone directory and file scanner utility.
 * Distinguishes between single card image drops and directory drops,
 * recursively traversing folder hierarchies and extracting all valid card images.
 */

export interface DroppedScanResult {
  files: File[];
  isDirectory: boolean;
  directoryName?: string;
  totalScannedCount: number;
}

const SUPPORTED_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|bmp|tiff|heic|gif)$/i;

/**
 * Recursively scans a FileSystemEntry (File or Directory) into a flat array of Files.
 */
async function scanEntry(entry: any, currentPath = ''): Promise<File[]> {
  return new Promise((resolve) => {
    if (!entry) {
      resolve([]);
      return;
    }

    if (entry.isFile) {
      entry.file(
        (file: File) => {
          // Attach relative path if not present
          if (currentPath && !(file as any).webkitRelativePath) {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: `${currentPath}${file.name}`,
              writable: true
            });
          }
          resolve([file]);
        },
        (err: any) => {
          console.warn(`[DropzoneScanner] Error reading file entry ${entry.name}:`, err);
          resolve([]);
        }
      );
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const collected: File[] = [];

      const readEntries = () => {
        dirReader.readEntries(
          async (entries: any[]) => {
            if (!entries || entries.length === 0) {
              resolve(collected);
            } else {
              for (const child of entries) {
                const nested = await scanEntry(child, `${currentPath}${entry.name}/`);
                collected.push(...nested);
              }
              // Chrome and WebKit read in batches of 100 max, keep reading until empty
              readEntries();
            }
          },
          (err: any) => {
            console.warn(`[DropzoneScanner] Error reading directory entry ${entry.name}:`, err);
            resolve(collected);
          }
        );
      };

      readEntries();
    } else {
      resolve([]);
    }
  });
}

/**
 * Inspects a DragEvent or DataTransfer object to scan and categorize dropped items.
 */
export async function scanDroppedItems(dataTransfer?: DataTransfer | null, fallbackFiles?: File[]): Promise<DroppedScanResult> {
  if (!dataTransfer && (!fallbackFiles || fallbackFiles.length === 0)) {
    return { files: [], isDirectory: false, totalScannedCount: 0 };
  }

  const items = dataTransfer?.items;
  let hasDirectory = false;
  let primaryDirectoryName: string | undefined = undefined;

  // Method 1: DataTransferItemList with webkitGetAsEntry
  if (items && items.length > 0) {
    const rootEntries: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry
          ? item.webkitGetAsEntry()
          : (item as any).getAsEntry
          ? (item as any).getAsEntry()
          : null;

        if (entry) {
          if (entry.isDirectory) {
            hasDirectory = true;
            if (!primaryDirectoryName) primaryDirectoryName = entry.name;
          }
          rootEntries.push(entry);
        }
      }
    }

    if (rootEntries.length > 0) {
      const allScannedFiles: File[] = [];
      for (const entry of rootEntries) {
        const filesFromEntry = await scanEntry(entry);
        allScannedFiles.push(...filesFromEntry);
      }

      // Filter for valid image formats
      const validImages = allScannedFiles.filter((file) => {
        return file.type.startsWith('image/') || SUPPORTED_IMAGE_EXTENSIONS.test(file.name);
      });

      return {
        files: validImages.length > 0 ? validImages : allScannedFiles,
        isDirectory: hasDirectory,
        directoryName: primaryDirectoryName,
        totalScannedCount: allScannedFiles.length
      };
    }
  }

  // Method 2: Fallback to standard File objects or FileList
  const rawFiles = fallbackFiles && fallbackFiles.length > 0
    ? fallbackFiles
    : Array.from(dataTransfer?.files || []);

  const hasRelativePath = rawFiles.some(
    (f: any) => f.webkitRelativePath && f.webkitRelativePath.includes('/')
  );

  if (hasRelativePath) {
    hasDirectory = true;
    const firstRel = rawFiles.find((f: any) => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    if (firstRel) {
      primaryDirectoryName = (firstRel as any).webkitRelativePath.split('/')[0];
    }
  }

  const validImages = rawFiles.filter((file) => {
    return file.type.startsWith('image/') || SUPPORTED_IMAGE_EXTENSIONS.test(file.name);
  });

  return {
    files: validImages.length > 0 ? validImages : rawFiles,
    isDirectory: hasDirectory,
    directoryName: primaryDirectoryName,
    totalScannedCount: rawFiles.length
  };
}

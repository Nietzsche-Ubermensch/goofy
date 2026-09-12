import JSZip from 'jszip';

/**
 * Dropzone directory, ZIP archive, and file scanner utility.
 * Distinguishes between single card image drops, directory drops, and ZIP archives,
 * recursively traversing folder hierarchies and extracting all valid card images.
 */

export interface DroppedScanResult {
  files: File[];
  isDirectory: boolean;
  isZipArchive?: boolean;
  directoryName?: string;
  totalScannedCount: number;
}

const SUPPORTED_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|bmp|tiff|heic|gif|avif)$/i;

function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'avif': return 'image/avif';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'tiff':
    case 'tif': return 'image/tiff';
    default: return 'image/png';
  }
}

export interface ZipProgressInfo {
  processed: number;
  total: number;
  filename: string;
  percent: number;
}

export interface DropzoneScanOptions {
  onProgress?: (info: ZipProgressInfo) => void;
  onChunk?: (files: File[]) => void;
  chunkSize?: number;
}

/**
 * Unpacks a ZIP File or Blob into an array of image File objects,
 * strictly enforcing non-blocking chunked decompression, event loop yielding,
 * and memory throttling to prevent browser crashes on large bulk uploads.
 */
export async function unpackZipFile(
  zipFile: File | Blob, 
  zipFileName = 'archive.zip',
  options?: DropzoneScanOptions
): Promise<File[]> {
  try {
    const zip = await JSZip.loadAsync(zipFile);
    const extractedFiles: File[] = [];

    const fileEntries = Object.keys(zip.files).filter(relativePath => {
      const zipEntry = zip.files[relativePath];
      if (zipEntry.dir || relativePath.includes('__MACOSX/') || relativePath.startsWith('._')) {
        return false;
      }
      return SUPPORTED_IMAGE_EXTENSIONS.test(relativePath);
    });

    const totalValid = fileEntries.length;
    const chunkSize = options?.chunkSize || 4;
    let pendingChunk: File[] = [];

    for (let i = 0; i < totalValid; i++) {
      const relativePath = fileEntries[i];
      const zipEntry = zip.files[relativePath];
      const filename = relativePath.split('/').pop() || `card_${i + 1}.png`;

      // Report live extraction progress
      if (options?.onProgress) {
        options.onProgress({
          processed: i + 1,
          total: totalValid,
          filename,
          percent: Math.round(((i + 1) / totalValid) * 100)
        });
      }

      const blob = await zipEntry.async('blob');
      const mimeType = getMimeTypeFromFilename(filename);
      
      const file = new File([blob], filename, {
        type: mimeType,
        lastModified: zipEntry.date ? zipEntry.date.getTime() : Date.now()
      });

      // Attach relative path for structured directory display
      Object.defineProperty(file, 'webkitRelativePath', {
        value: relativePath,
        writable: true
      });

      extractedFiles.push(file);
      pendingChunk.push(file);

      // Throttling: yield to event loop every chunkSize items to prevent browser lag & memory spikes
      if (pendingChunk.length >= chunkSize || i === totalValid - 1) {
        if (options?.onChunk && pendingChunk.length > 0) {
          options.onChunk([...pendingChunk]);
        }
        pendingChunk = [];
        // Non-blocking yield
        await new Promise(resolve => setTimeout(resolve, 8));
      }
    }

    return extractedFiles;
  } catch (err) {
    console.error(`[DropzoneScanner] Failed to unpack ZIP file "${zipFileName}":`, err);
    return [];
  }
}

/**
 * Recursively scans a FileSystemEntry (File or Directory) into a flat array of Files.
 */
async function scanEntry(entry: any, currentPath = '', options?: DropzoneScanOptions): Promise<File[]> {
  return new Promise((resolve) => {
    if (!entry) {
      resolve([]);
      return;
    }

    if (entry.isFile) {
      entry.file(
        async (file: File) => {
          // Check if file is a ZIP archive
          if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
            const unzipped = await unpackZipFile(file, file.name, options);
            resolve(unzipped);
            return;
          }

          // Attach relative path if not present
          if (currentPath && !(file as any).webkitRelativePath) {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: `${currentPath}${file.name}`,
              writable: true
            });
          }
          if (options?.onChunk) {
            options.onChunk([file]);
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
                const nested = await scanEntry(child, `${currentPath}${entry.name}/`, options);
                collected.push(...nested);
                // Yield periodically during deep directory trees
                await new Promise(r => setTimeout(r, 2));
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
 * Inspects a DragEvent or DataTransfer object to scan and categorize dropped items,
 * seamlessly unpacking ZIP archives and directory hierarchies into card image files.
 */
export async function scanDroppedItems(
  dataTransfer?: DataTransfer | null, 
  fallbackFiles?: File[],
  options?: DropzoneScanOptions
): Promise<DroppedScanResult> {
  if (!dataTransfer && (!fallbackFiles || fallbackFiles.length === 0)) {
    return { files: [], isDirectory: false, totalScannedCount: 0 };
  }

  const items = dataTransfer?.items;
  let hasDirectory = false;
  let hasZip = false;
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
          } else if (entry.name && entry.name.toLowerCase().endsWith('.zip')) {
            hasZip = true;
            if (!primaryDirectoryName) primaryDirectoryName = entry.name.replace(/\.zip$/i, '');
          }
          rootEntries.push(entry);
        }
      }
    }

    if (rootEntries.length > 0) {
      const allScannedFiles: File[] = [];
      for (const entry of rootEntries) {
        const filesFromEntry = await scanEntry(entry, '', options);
        allScannedFiles.push(...filesFromEntry);
      }

      // Filter for valid image formats
      const validImages = allScannedFiles.filter((file) => {
        return file.type.startsWith('image/') || SUPPORTED_IMAGE_EXTENSIONS.test(file.name);
      });

      return {
        files: validImages.length > 0 ? validImages : allScannedFiles,
        isDirectory: hasDirectory || hasZip,
        isZipArchive: hasZip,
        directoryName: primaryDirectoryName,
        totalScannedCount: allScannedFiles.length
      };
    }
  }

  // Method 2: Fallback to standard File objects or FileList
  const rawFiles = fallbackFiles && fallbackFiles.length > 0
    ? fallbackFiles
    : Array.from(dataTransfer?.files || []);

  const processedFiles: File[] = [];

  for (const f of rawFiles) {
    if (f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') {
      hasZip = true;
      if (!primaryDirectoryName) primaryDirectoryName = f.name.replace(/\.zip$/i, '');
      const unzipped = await unpackZipFile(f, f.name, options);
      processedFiles.push(...unzipped);
    } else {
      processedFiles.push(f);
      if (options?.onChunk) {
        options.onChunk([f]);
      }
    }
  }

  const hasRelativePath = processedFiles.some(
    (f: any) => f.webkitRelativePath && f.webkitRelativePath.includes('/')
  );

  if (hasRelativePath) {
    hasDirectory = true;
    const firstRel = processedFiles.find((f: any) => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    if (firstRel && !primaryDirectoryName) {
      primaryDirectoryName = (firstRel as any).webkitRelativePath.split('/')[0];
    }
  }

  const validImages = processedFiles.filter((file) => {
    return file.type.startsWith('image/') || SUPPORTED_IMAGE_EXTENSIONS.test(file.name);
  });

  return {
    files: validImages.length > 0 ? validImages : processedFiles,
    isDirectory: hasDirectory || hasZip,
    isZipArchive: hasZip,
    directoryName: primaryDirectoryName,
    totalScannedCount: processedFiles.length
  };
}

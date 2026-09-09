import { useState } from 'react';
import { uploadFile } from '@better-upload/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface FileUploadState {
  name: string;
  size: number;
  progress: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
}

export function useBetterUpload(route = 'images') {
  const [fileStates, setFileStates] = useState<Record<string, FileUploadState>>({});
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setFileStates((prev) => ({
        ...prev,
        [file.name]: {
          name: file.name,
          size: file.size,
          progress: 0,
          status: 'uploading',
        },
      }));

      try {
        const result = await uploadFile({
          file,
          route,
          api: '/upload',
          onFileStateChange: ({ file: trackedFile }: { file: any }) => {
            const progress = trackedFile?.progress || (trackedFile?.status === 'completed' ? 100 : 50);
            setFileStates((prev) => ({
              ...prev,
              [file.name]: {
                name: file.name,
                size: file.size,
                progress,
                status: trackedFile?.status === 'completed' ? 'completed' : 'uploading',
                url: trackedFile?.url,
              },
            }));
          },
        });

        setFileStates((prev) => ({
          ...prev,
          [file.name]: {
            name: file.name,
            size: file.size,
            progress: 100,
            status: 'completed',
            url: (result as any)?.url || (result as any)?.key,
          },
        }));

        queryClient.invalidateQueries({ queryKey: ['s3-objects'] });
        return result;
      } catch (err: any) {
        setFileStates((prev) => ({
          ...prev,
          [file.name]: {
            name: file.name,
            size: file.size,
            progress: 0,
            status: 'error',
            error: err.message || 'Upload failed',
          },
        }));
        throw err;
      }
    },
  });

  return {
    upload: uploadMutation.mutate,
    uploadAsync: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    error: uploadMutation.error,
    fileStates,
    resetStates: () => setFileStates({}),
  };
}

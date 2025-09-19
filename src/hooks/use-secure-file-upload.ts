/**
 * React Hook for Secure File Upload in Chat System
 * Provides complete file upload functionality with security validation
 */

import { useState, useCallback } from 'react'
import { useUser } from '@/hooks/use-user'
import {
  uploadChatFile,
  createFileMetadata,
  getUserStorageStats,
  type UploadResult
} from '@/lib/chat-files-security'

interface UseSecureFileUploadOptions {
  roomId: string
  onUploadComplete?: (result: UploadResult) => void
  onUploadError?: (error: string) => void
  onUploadProgress?: (progress: number) => void
}

interface FileUploadState {
  isUploading: boolean
  progress: number
  error: string | null
  uploadedFiles: UploadResult[]
}

export function useSecureFileUpload({
  roomId,
  onUploadComplete,
  onUploadError,
  onUploadProgress
}: UseSecureFileUploadOptions) {
  const { user } = useUser()
  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    uploadedFiles: []
  })

  const [storageStats, setStorageStats] = useState<{
    used: number
    quota: number
    percentage: number
  } | null>(null)

  // Load storage stats
  const loadStorageStats = useCallback(async () => {
    if (!user?.id) return

    const stats = await getUserStorageStats(user.id)
    if (stats) {
      setStorageStats(stats)
    }
  }, [user?.id])

  // Upload multiple files
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!user?.id) {
      const error = 'User not authenticated'
      setState(prev => ({ ...prev, error }))
      onUploadError?.(error)
      return
    }

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: 0,
      error: null
    }))

    try {
      const results: UploadResult[] = []
      const totalFiles = files.length

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // Update progress
        const progressPercent = Math.round((i / totalFiles) * 100)
        setState(prev => ({ ...prev, progress: progressPercent }))
        onUploadProgress?.(progressPercent)

        // Upload file
        const result = await uploadChatFile(roomId, file, user.id)
        results.push(result)

        if (result.success) {
          onUploadComplete?.(result)
        } else {
          const error = result.error || 'Upload failed'
          setState(prev => ({ ...prev, error }))
          onUploadError?.(error)
          break
        }
      }

      // Final progress update
      setState(prev => ({
        ...prev,
        isUploading: false,
        progress: 100,
        uploadedFiles: [...prev.uploadedFiles, ...results.filter(r => r.success)]
      }))

      // Refresh storage stats
      await loadStorageStats()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage
      }))
      onUploadError?.(errorMessage)
    }
  }, [user?.id, roomId, onUploadComplete, onUploadError, onUploadProgress, loadStorageStats])

  // Upload single file
  const uploadFile = useCallback(async (file: File) => {
    return uploadFiles([file])
  }, [uploadFiles])

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Reset state
  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null,
      uploadedFiles: []
    })
  }, [])

  return {
    // State
    ...state,
    storageStats,

    // Actions
    uploadFile,
    uploadFiles,
    loadStorageStats,
    clearError,
    reset,

    // Computed
    canUpload: !state.isUploading && user?.id,
    isQuotaExceeded: storageStats ? storageStats.percentage >= 95 : false
  }
}

/**
 * Hook for file drop functionality
 */
export function useFileDropZone(
  onFilesDropped: (files: File[]) => void,
  options: {
    maxFiles?: number
    accept?: string[]
  } = {}
) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)

    // Apply file filters
    let filteredFiles = files

    if (options.maxFiles) {
      filteredFiles = filteredFiles.slice(0, options.maxFiles)
    }

    if (options.accept && options.accept.length > 0) {
      filteredFiles = filteredFiles.filter(file =>
        options.accept!.some(type =>
          file.type.match(type.replace('*', '.*'))
        )
      )
    }

    if (filteredFiles.length > 0) {
      onFilesDropped(filteredFiles)
    }
  }, [onFilesDropped, options.maxFiles, options.accept])

  return {
    isDragOver,
    dragHandlers: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    }
  }
}
'use client'

/**
 * Secure File Upload Component for Chat System
 * Provides drag-and-drop file upload with security validation
 */

import React, { useRef } from 'react'
import { Upload, File, AlertTriangle, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useSecureFileUpload, useFileDropZone } from '@/hooks/use-secure-file-upload'
import { SECURITY_CONFIG } from '@/lib/chat-files-security'

interface SecureFileUploadProps {
  roomId: string
  onFileUpload?: (filePath: string, fileName: string, fileSize: number) => void
  className?: string
}

export function SecureFileUpload({
  roomId,
  onFileUpload,
  className = ''
}: SecureFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    isUploading,
    progress,
    error,
    storageStats,
    uploadFiles,
    loadStorageStats,
    clearError,
    canUpload,
    isQuotaExceeded
  } = useSecureFileUpload({
    roomId,
    onUploadComplete: (result) => {
      if (result.success && result.filePath && result.metadata) {
        onFileUpload?.(
          result.filePath,
          result.metadata.sanitizedName,
          result.metadata.fileSize
        )
      }
    },
    onUploadError: (error) => {
      console.error('Upload error:', error)
    }
  })

  const { isDragOver, dragHandlers } = useFileDropZone(
    (files) => {
      if (canUpload && !isQuotaExceeded) {
        uploadFiles(files)
      }
    },
    {
      maxFiles: 5,
      accept: SECURITY_CONFIG.ALLOWED_MIME_TYPES
    }
  )

  // Load storage stats on mount
  React.useEffect(() => {
    loadStorageStats()
  }, [loadStorageStats])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0 && canUpload && !isQuotaExceeded) {
      uploadFiles(files)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getAcceptedFileTypes = () => {
    return SECURITY_CONFIG.ALLOWED_MIME_TYPES.join(',')
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Storage Quota Display */}
      {storageStats && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Storage Usage</span>
            <span>
              {formatFileSize(storageStats.used)} / {formatFileSize(storageStats.quota)}
            </span>
          </div>
          <Progress value={storageStats.percentage} className="h-2" />
          {storageStats.percentage >= 90 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {storageStats.percentage >= 95
                  ? 'Storage quota exceeded. Please delete some files.'
                  : 'Storage quota almost full. Consider deleting old files.'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex justify-between items-center">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="h-auto p-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading files...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Drop Zone */}
      <div
        {...dragHandlers}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${canUpload && !isQuotaExceeded ? 'hover:border-primary/50 cursor-pointer' : 'opacity-50 cursor-not-allowed'}
        `}
        onClick={() => {
          if (canUpload && !isQuotaExceeded) {
            fileInputRef.current?.click()
          }
        }}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-2">
          {isDragOver
            ? 'Drop files here'
            : 'Drag and drop files here, or click to select'}
        </p>
        <p className="text-xs text-muted-foreground">
          Maximum file size: {formatFileSize(SECURITY_CONFIG.MAX_FILE_SIZE)}
        </p>

        {/* Security Info */}
        <div className="mt-3 flex flex-wrap gap-1 justify-center">
          <Badge variant="secondary" className="text-xs">
            Images
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Documents
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Videos
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Audio
          </Badge>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={getAcceptedFileTypes()}
        onChange={handleFileSelect}
        className="hidden"
        disabled={!canUpload || isQuotaExceeded}
      />

      {/* Upload Button (Alternative) */}
      <div className="flex justify-center">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={!canUpload || isQuotaExceeded || isUploading}
          variant="outline"
          size="sm"
        >
          <File className="h-4 w-4 mr-2" />
          Choose Files
        </Button>
      </div>

      {/* Security Information */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">
          Security Information
        </summary>
        <div className="mt-2 space-y-1 pl-4">
          <p>✓ Files are scanned for malware</p>
          <p>✓ Only authorized file types allowed</p>
          <p>✓ Automatic filename sanitization</p>
          <p>✓ End-to-end encryption in transit</p>
          <p>✓ Access restricted to chat participants</p>
        </div>
      </details>
    </div>
  )
}

/**
 * File Message Component - displays uploaded files in chat
 */
interface FileMessageProps {
  fileName: string
  fileSize: number
  mimeType: string
  filePath: string
  isOwner: boolean
  onDelete?: () => void
}

export function FileMessage({
  fileName,
  fileSize,
  mimeType,
  filePath,
  isOwner,
  onDelete
}: FileMessageProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.startsWith('video/')) return '🎥'
    if (mimeType.startsWith('audio/')) return '🎵'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('word')) return '📝'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
    if (mimeType.includes('zip')) return '📦'
    return '📎'
  }

  const handleDownload = async () => {
    try {
      // Get secure download URL
      const response = await fetch(`/api/chat/files/download?path=${encodeURIComponent(filePath)}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  return (
    <div className="flex items-center space-x-3 p-3 border rounded-lg bg-muted/50">
      <span className="text-2xl">{getFileIcon(mimeType)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
      </div>
      <div className="flex space-x-2">
        <Button size="sm" variant="outline" onClick={handleDownload}>
          Download
        </Button>
        {isOwner && onDelete && (
          <Button size="sm" variant="outline" onClick={onDelete}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
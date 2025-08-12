import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const videoExtensions = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.m4v',
  '.flv',
  '.wmv',
]
export const imageExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.tiff',
  '.ico',
]
export const pdfExtensions = ['.pdf']
export const textExtensions = [
  '.txt',
  '.md',
  '.log',
  '.json',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.css',
  '.html',
  '.htm',
  '.xml',
  '.yaml',
  '.yml',
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.rb',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.go',
  '.rs',
  '.php',
  '.ini',
  '.cfg',
  '.env',
]

const allExtensions = [
  ...videoExtensions,
  ...imageExtensions,
  ...pdfExtensions,
  ...textExtensions,
]

const hasExtension = (fileName: string, extensions: string[]): boolean => {
  const lowerCaseFileName = fileName.toLowerCase()
  return extensions.some((ext) => lowerCaseFileName.endsWith(ext))
}

export const isVideo = (fileName: string): boolean =>
  hasExtension(fileName, videoExtensions)

export const isImage = (fileName: string): boolean =>
  hasExtension(fileName, imageExtensions)

export const isPdf = (fileName: string): boolean =>
  hasExtension(fileName, pdfExtensions)

export const isText = (fileName: string): boolean =>
  hasExtension(fileName, textExtensions)

export const getMediaType = (
  fileName: string
): 'video' | 'image' | 'pdf' | 'text' | undefined => {
  if (isVideo(fileName)) return 'video'
  if (isImage(fileName)) return 'image'
  if (isPdf(fileName)) return 'pdf'
  if (isText(fileName)) return 'text'
  return undefined
}

export const getContentType = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''

  // 비디오 파일
  switch (ext) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4'
    case 'mov':
      return 'video/quicktime'
    case 'avi':
      return 'video/x-msvideo'
    case 'mkv':
      return 'video/x-matroska'
    case 'webm':
      return 'video/webm'
    case 'flv':
      return 'video/x-flv'
    case 'wmv':
      return 'video/x-ms-wmv'
    // 이미지 파일
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    case 'svg':
      return 'image/svg+xml'
    case 'tiff':
      return 'image/tiff'
    case 'ico':
      return 'image/x-icon'
    // PDF 파일
    case 'pdf':
      return 'application/pdf'
    // 텍스트 파일
    case 'txt':
    case 'md':
    case 'log':
    case 'json':
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
    case 'css':
    case 'html':
    case 'htm':
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'py':
    case 'rb':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
    case 'go':
    case 'rs':
    case 'php':
    case 'ini':
    case 'cfg':
    case 'env':
      return 'text/plain; charset=utf-8'
    // 기본값
    default:
      return 'application/octet-stream'
  }
}

export const isMediaFile = (fileName: string): boolean =>
  hasExtension(fileName, allExtensions)

/**
 * 파일 크기를 읽기 쉬운 형태로 포맷합니다
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

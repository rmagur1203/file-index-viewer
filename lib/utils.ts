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

const allExtensions = [...videoExtensions, ...imageExtensions, ...pdfExtensions]

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

export const getMediaType = (
  fileName: string
): 'video' | 'image' | 'pdf' | 'file' => {
  if (isVideo(fileName)) return 'video'
  if (isImage(fileName)) return 'image'
  if (isPdf(fileName)) return 'pdf'
  return 'file'
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
    // 기본값
    default:
      return 'application/octet-stream'
  }
}

export const isMediaFile = (fileName: string): boolean =>
  hasExtension(fileName, allExtensions)

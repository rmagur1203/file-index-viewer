export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  createdAt?: string
  modifiedAt?: string
  thumbnail?: string
  mediaType?: 'video' | 'image' | 'pdf'
  accessDenied?: boolean
}

export interface FolderTree {
  [key: string]: FolderTree
}

export interface DuplicateGroup {
  id: string
  type: 'image' | 'video'
  files: DuplicateFile[]
  similarity: number
}

export interface DuplicateFile {
  path: string
  relativePath: string // VIDEO_ROOT를 기준으로 한 상대 경로
  name: string
  size: number
  hash: string
  perceptualHash?: string
  modifiedAt: string
}

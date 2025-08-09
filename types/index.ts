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

import type { FileItem, FolderTree } from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const handleResponse = async (response: Response) => {
  const data = await response.json()
  if (response.ok) {
    return data
  } else {
    throw new Error(data.error || `HTTP error! status: ${response.status}`)
  }
}

export const fetchFiles = async (path: string): Promise<FileItem[]> => {
  const response = await fetch(
    `${API_BASE_URL}/api/files?path=${encodeURIComponent(path)}`
  )
  const data = await handleResponse(response)
  return data.files || []
}

export const fetchFolderTree = async (): Promise<FolderTree> => {
  const response = await fetch(`${API_BASE_URL}/api/files/tree`)
  const data = await handleResponse(response)
  return data.tree || {}
}

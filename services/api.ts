import { FileItem, FolderTree } from '@/hooks/useFileBrowser'

const handleResponse = async (response: Response) => {
  const data = await response.json()
  if (response.ok) {
    return data
  } else {
    throw new Error(data.error || `HTTP error! status: ${response.status}`)
  }
}

export const fetchFiles = async (path: string): Promise<FileItem[]> => {
  const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
  const data = await handleResponse(response)
  return data.files || []
}

export const fetchFolderTree = async (): Promise<FolderTree> => {
  const response = await fetch('/api/files/tree')
  const data = await handleResponse(response)
  return data.tree || {}
}

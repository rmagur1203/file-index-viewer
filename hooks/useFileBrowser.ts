'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQueryState } from 'nuqs'
import { fetchFiles, fetchFolderTree } from '@/services/api'
import type { FileItem, FolderTree } from '@/types'

export type { FileItem, FolderTree }

export const useFileBrowser = (initialPath: string = '/') => {
  const [currentPath, setCurrentPath] = useQueryState('path', {
    defaultValue: initialPath,
  })
  const [history, setHistory] = useState([currentPath])

  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [folderTree, setFolderTree] = useState<FolderTree>({})

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true)
    try {
      const files = await fetchFiles(path)
      setFiles(files)
    } catch (error) {
      console.error('Error fetching files:', error)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFolderTree = useCallback(async () => {
    try {
      const tree = await fetchFolderTree()
      setFolderTree(tree)
    } catch (error) {
      console.error('Error fetching folder tree:', error)
      setFolderTree({})
    }
  }, [])

  useEffect(() => {
    loadFiles(currentPath)
  }, [currentPath, loadFiles])

  useEffect(() => {
    loadFolderTree()
  }, [loadFolderTree])

  const navigateTo = (path: string) => {
    if (path !== currentPath) {
      setCurrentPath(path).then(() => {
        setHistory((prev) => [...prev, path])
      })
    }
  }

  const navigateBack = () => {
    if (history.length > 1) {
      const newHistory = [...history]
      newHistory.pop()
      const previousPath = newHistory[newHistory.length - 1]
      setCurrentPath(previousPath).then(() => {
        setHistory(newHistory)
      })
    }
  }

  const navigateToParent = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    navigateTo(parentPath)
  }

  return {
    currentPath,
    files,
    loading,
    folderTree,
    navigateTo,
    navigateBack,
    navigateToParent,
    canNavigateBack: history.length > 1,
  }
}

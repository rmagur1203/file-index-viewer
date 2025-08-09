import React, { useEffect, useState } from 'react'

interface TextViewerProps {
  src: string
}

const TextViewer: React.FC<TextViewerProps> = ({ src }) => {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTextContent = async () => {
      try {
        setLoading(true)
        const response = await fetch(src)
        if (!response.ok) {
          throw new Error('Failed to fetch file content')
        }
        const text = await response.text()
        setContent(text)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'An unknown error occurred'
        )
      } finally {
        setLoading(false)
      }
    }

    if (src) {
      fetchTextContent()
    }
  }, [src])

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <pre
      style={{
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        padding: '1rem',
        color: 'white',
      }}
    >
      {content}
    </pre>
  )
}

export default TextViewer

import { NextRequest, NextResponse } from 'next/server'
import { getTextAnalyzer } from '../../../lib/ai-text-analyzer'
import { promises as fs } from 'fs'
import { exec } from 'child_process'

async function checkPdftotext(): Promise<{
  exists: boolean
  path?: string
  error?: string
}> {
  return new Promise((resolve) => {
    exec('which pdftotext', (error, stdout, stderr) => {
      if (error) {
        resolve({ exists: false, error: stderr || error.message })
        return
      }
      resolve({ exists: true, path: stdout.trim() })
    })
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('filePath')

  if (!filePath) {
    return NextResponse.json(
      { error: 'Please provide a filePath query parameter.' },
      { status: 400 }
    )
  }

  try {
    await fs.access(filePath)
  } catch (error) {
    return NextResponse.json(
      { error: `File not found or not accessible: ${filePath}` },
      { status: 404 }
    )
  }

  try {
    const analyzer = await getTextAnalyzer()

    console.log(`[Debug Endpoint] Analyzing file: ${filePath}`)
    const result = await analyzer.extractFeatures(filePath)
    const text = result?.text || ''
    const metadata = result?.metadata

    const pdftotextStatus = await checkPdftotext()

    return NextResponse.json({
      filePath,
      pdftotextStatus,
      wordCount: metadata?.wordCount ?? 0,
      charCount: metadata?.charCount ?? 0,
      language: metadata?.language ?? 'unknown',
      extractedTextSnippet:
        text.substring(0, 500) + (text.length > 500 ? '...' : ''),
    })
  } catch (error: any) {
    console.error(
      `[Debug Endpoint] Error extracting text from ${filePath}:`,
      error
    )
    return NextResponse.json(
      {
        error: 'Failed to extract text from file.',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}

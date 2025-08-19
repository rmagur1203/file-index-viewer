'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex h-screen items-center justify-center p-8 text-center">
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">애플리케이션 오류</h1>
            <p className="text-muted-foreground">
              {error?.message ?? '알 수 없는 오류가 발생했습니다.'}
            </p>
            <button
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
              onClick={() => reset()}
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">페이지를 찾을 수 없어요</h1>
        <p className="text-muted-foreground">
          요청하신 페이지가 존재하지 않습니다.
        </p>
      </div>
    </div>
  )
}

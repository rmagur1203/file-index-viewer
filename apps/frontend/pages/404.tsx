export default function NotFoundPage() {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
          }}
        >
          페이지를 찾을 수 없어요
        </h1>
        <p style={{ color: '#6b7280' }}>요청하신 페이지가 존재하지 않습니다.</p>
      </div>
    </div>
  )
}

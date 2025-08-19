export default function ServerErrorPage() {
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
          서버 오류가 발생했어요
        </h1>
        <p style={{ color: '#6b7280' }}>잠시 후 다시 시도해 주세요.</p>
      </div>
    </div>
  )
}

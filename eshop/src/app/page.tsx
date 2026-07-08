export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 12px", color: "#1f2937" }}>
        PROVLAJKY<span style={{ color: "#2563eb" }}>.CZ</span>
      </h1>
      <p style={{ fontSize: 18, color: "#6b7280", margin: 0 }}>Nový e-shop se připravuje.</p>
    </div>
  );
}

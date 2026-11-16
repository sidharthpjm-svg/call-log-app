import { useEffect, useState } from "react";

// The backend URL: localhost while developing, your Render URL once deployed
const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [calls, setCalls] = useState([]);
  const [error, setError] = useState(null);

  const loadCalls = () => {
    fetch(`${API}/calls`)
      .then((res) => res.json())
      .then(setCalls)
      .catch((err) => setError(err.message));
  };

  useEffect(loadCalls, []);

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Loan Lead Call Log</h1>
      <button onClick={loadCalls}>Refresh</button>
      {error && <p style={{ color: "red" }}>Could not load calls: {error}</p>}

      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Phone</th>
            <th>Outcome</th>
            <th>Notes</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.id}>
              <td>{c.lead_name}</td>
              <td>{c.phone}</td>
              <td>{c.outcome}</td>
              <td>{c.notes}</td>
              <td>{new Date(c.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

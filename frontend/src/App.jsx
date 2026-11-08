import { useEffect, useState } from "react";
import Scene3D from "./Scene3D";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const id = new URLSearchParams(window.location.search).get("w");
  const [wish, setWish] = useState(null);
  const [quote, setQuote] = useState("");
  const [form, setForm] = useState({ to_name: "", from_name: "", message: "" });
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/quote`).then((r) => r.json()).then((d) => setQuote(d.quote)).catch(() => {});
    if (id) {
      fetch(`${API}/api/wishes/${id}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setWish)
        .catch(() => setErr("This wish couldn't be found. It may have expired."));
    }
  }, [id]);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${API}/api/wishes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setLink(`${window.location.origin}/?w=${d.id}`);
    } catch {
      setErr("Something went wrong. The server may be waking up, so please try again.");
    }
    setLoading(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page">
      <Scene3D />

      <main className="card">
        <p className="eyebrow">✨ शुभ दीपावली ✨</p>

        {wish ? (
          <>
            <h1>Happy Diwali,<br /><span>{wish.to_name}!</span></h1>
            {wish.message && <p className="msg">“{wish.message}”</p>}
            <p className="quote">{quote}</p>
            <p className="from">With love, <b>{wish.from_name}</b> 🪔</p>
            <a className="btn" href="/">Send a wish of your own</a>
          </>
        ) : id && err ? (
          <>
            <h1>Oops!</h1>
            <p className="quote">{err}</p>
            <a className="btn" href="/">Create a wish</a>
          </>
        ) : (
          <>
            <h1>Spread the <span>Light</span></h1>
            <p className="quote">
              {quote || "Create a personal Diwali greeting and share it with someone you love."}
            </p>

            {!link ? (
              <form onSubmit={submit}>
                <input placeholder="Their name" value={form.to_name} onChange={update("to_name")} maxLength={40} required />
                <input placeholder="Your name" value={form.from_name} onChange={update("from_name")} maxLength={40} required />
                <textarea placeholder="Add a personal message (optional)" value={form.message} onChange={update("message")} maxLength={300} rows={3} />
                <button className="btn" disabled={loading}>
                  {loading ? "Lighting the diyas..." : "Create my wish 🪔"}
                </button>
                {err && <p className="error">{err}</p>}
              </form>
            ) : (
              <div className="share">
                <p>Your wish is ready! Share this link:</p>
                <input readOnly value={link} onFocus={(e) => e.target.select()} />
                <div className="row">
                  <button className="btn" onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</button>
                  <a className="btn alt" target="_blank" rel="noreferrer"
                     href={`https://wa.me/?text=${encodeURIComponent("Happy Diwali! 🪔 Open your wish: " + link)}`}>
                    WhatsApp
                  </a>
                </div>
                <a className="again" href="/">Create another</a>
              </div>
            )}
          </>
        )}

        <p className="hint">Tap anywhere on the sky to launch fireworks 🎆</p>
      </main>
    </div>
  );
}
import { useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [log, setLog] = useState([]);
  const [profile, setProfile] = useState({
    allergies: "none",
    goal: "low_sodium",
    budget: "high",
  });

  const addLog = (msg) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...prev].slice(0, 20));

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function connectWS() {
    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("WS connected");
      addLog(`WebSocket connected → ${WS_URL}`);

      // Send profile once at start (server keeps it in memory)
      ws.send(
        JSON.stringify({
          type: "profile",
          profile,
        })
      );
    };

    ws.onmessage = (evt) => {
      // assume server sends text JSON or plain text
      let text = "";
      try {
        const obj = JSON.parse(evt.data);
        text = obj.text ?? JSON.stringify(obj);
      } catch {
        text = String(evt.data);
      }
      addLog(`Gemini: ${text}`);
      speak(text);
    };

    ws.onclose = () => {
      setStatus("WS closed");
      addLog("WebSocket closed");
    };

    ws.onerror = () => {
      setStatus("WS error");
      addLog("WebSocket error");
    };
  }

  function disconnectWS() {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }

  function speak(text) {
    // basic browser TTS
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  }

  function startSnapshots() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");

    timerRef.current = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      // Scale down to reduce bandwidth
      const targetW = 320;
      const scale = targetW / video.videoWidth;
      const w = targetW;
      const h = Math.round(video.videoHeight * scale);

      canvas.width = w;
      canvas.height = h;

      ctx.drawImage(video, 0, 0, w, h);

      canvas.toBlob(
        async (blob) => {
          if (!blob) return;
          const buffer = await blob.arrayBuffer();

          // Send a small header message occasionally if you want,
          // but for now just send raw JPEG bytes:
          wsRef.current.send(buffer);
        },
        "image/jpeg",
        0.6
      );
    }, 300);
  }

  function stopSnapshots() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function handleStart() {
    try {
      setStatus("Starting…");
      addLog("Starting camera…");
      await startCamera();

      addLog("Connecting WebSocket…");
      connectWS();

      addLog("Starting snapshot stream…");
      startSnapshots();

      setRunning(true);
      setStatus("Running");
    } catch (e) {
      console.error(e);
      addLog(`Error: ${e.message || e}`);
      setStatus("Error");
      stopSnapshots();
      disconnectWS();
      stopCamera();
      setRunning(false);
    }
  }

  function handleStop() {
    addLog("Stopping…");
    stopSnapshots();
    disconnectWS();
    stopCamera();
    setRunning(false);
    setStatus("Stopped");
  }

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopSnapshots();
      disconnectWS();
      stopCamera();
    };
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2>Gemini Camera for Visual Assistance</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
            <video ref={videoRef} style={{ width: "100%", background: "#000" }} playsInline muted />
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={handleStart} disabled={running}>
              Start
            </button>
            <button onClick={handleStop} disabled={!running}>
              Stop
            </button>
            <span style={{ marginLeft: 12, opacity: 0.8 }}>Status: {status}</span>
          </div>

          {/* hidden canvas used for frame capture */}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        <div>
          <h3>Dietary profile</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              Allergies
              <select
                value={profile.allergies}
                onChange={(e) => setProfile((p) => ({ ...p, allergies: e.target.value }))}
                disabled={running}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="none">none</option>
                <option value="nuts">nuts</option>
                <option value="dairy">dairy</option>
                <option value="gluten">gluten</option>
              </select>
            </label>

            <label>
              Goal
              <select
                value={profile.goal}
                onChange={(e) => setProfile((p) => ({ ...p, goal: e.target.value }))}
                disabled={running}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="low_sodium">low sodium</option>
                <option value="low_sugar">low sugar</option>
                <option value="high_protein">high protein</option>
                <option value="high_fiber">high fiber</option>
                <option value="low_calorie">low calorie</option>
                <option value="low_fat">low fat</option>
                <option value="low_cholesterol">low cholesterol</option>
                <option value="low_carb">low carb</option>
              </select>
            </label>

            <label>
              Budget sensitivity
              <select
                value={profile.budget}
                onChange={(e) => setProfile((p) => ({ ...p, budget: e.target.value }))}
                disabled={running}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>

            <p style={{ marginTop: 6, opacity: 0.7 }}>
              (Profile is sent once when WS connects. Stop → change → Start again.)
            </p>
          </div>

          <h3 style={{ marginTop: 16 }}>Log</h3>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, height: 260, overflow: "auto" }}>
            {log.map((line, i) => (
              <div key={i} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p style={{ marginTop: 16, opacity: 0.75 }}>
        WS target: <code>{WS_URL}</code> (set <code>VITE_WS_URL</code> in <code>.env</code> if needed)
      </p>
    </div>
  );
}
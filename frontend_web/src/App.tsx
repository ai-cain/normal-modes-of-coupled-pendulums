import { useEffect, useRef, useState, useMemo } from 'react';
import './index.css';

interface SimulationData {
  n: number;
  lengths: number[];
  g: number;
  frequencies: number[];
  modal_shapes: number[][]; // [row_i][col_j] -> V_{i,j}
  inverse_modal_shapes: number[][]; // V^-1
}

function App() {
  const [n, setN] = useState<number>(4);
  const [g, setG] = useState<number>(9.8);
  const [lengths, setLengths] = useState<number[]>([0.28, 0.28, 0.28, 0.28]);
  const [initialAngles, setInitialAngles] = useState<number[]>([0.5, 0, 0, 0]); // Radians
  
  const [data, setData] = useState<SimulationData | null>(null);
  const [error, setError] = useState<string>('');
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timeRef = useRef<number>(0);
  const lastFrameTime = useRef<number>(performance.now());
  
  // Connect to backend
  useEffect(() => {
    const wsUrl = 'ws://localhost:3001';
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      requestUpdate(n, lengths, g);
    };
    
    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.error) {
        setError(msg.error);
        return;
      }
      if (msg.type === 'modes_result') {
        setData(msg.data);
        setError('');
      }
    };
    
    return () => wsRef.current?.close();
  }, []);

  const requestUpdate = (pendulums: number, lens: number[], gravity: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ n: pendulums, lengths: lens, g: gravity }));
    }
  };

  const handleNChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setN(val);
    const newLengths = Array(val).fill(1.12 / val);
    const newAngles = Array(val).fill(0);
    newAngles[0] = 0.5; // Default first pendulum disturbed
    setLengths(newLengths);
    setInitialAngles(newAngles);
    timeRef.current = 0; // Reset time
    requestUpdate(val, newLengths, g);
  };
  
  const handleLengthChange = (index: number, val: number) => {
    const newLengths = [...lengths];
    newLengths[index] = val;
    setLengths(newLengths);
    requestUpdate(n, newLengths, g);
  };

  const handleAngleChange = (index: number, val: number) => {
    const newAngles = [...initialAngles];
    newAngles[index] = val;
    setInitialAngles(newAngles);
    timeRef.current = 0; // Reset time so we see the new initial state
  };

  // Compute the modal coefficients: c = V^-1 * theta_0
  const modalCoefficients = useMemo(() => {
    if (!data) return [];
    const c = new Array(n).fill(0);
    const V_inv = data.inverse_modal_shapes;
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
            sum += V_inv[i][j] * initialAngles[j];
        }
        c[i] = sum;
    }
    return c;
  }, [data, initialAngles, n]);

  // Canvas Animation loop
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    
    let animationId: number;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    
    const draw = (now: number) => {
      const dt = (now - lastFrameTime.current) / 1000;
      lastFrameTime.current = now;
      
      if (isPlaying) {
          timeRef.current += dt;
      }
      
      const t = timeRef.current;
      ctx.clearRect(0, 0, w, h);
      
      const totalL = lengths.reduce((a, b) => a + b, 0);
      const scaleY = (h * 0.8) / (totalL || 1);
      
      let curX = w / 2;
      let curY = 50;
      
      // Draw ceiling
      ctx.beginPath();
      ctx.moveTo(w/2 - 100, curY);
      ctx.lineTo(w/2 + 100, curY);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fff';
      ctx.stroke();

      for (let i = 0; i < n; i++) {
        // Evaluate the angle: theta_i(t) = sum(c_k * V_{i,k} * cos(w_k * t))
        let angle = 0;
        for(let k = 0; k < n; k++) {
            const w_k = data.frequencies[k];
            const V_ik = data.modal_shapes[i][k];
            angle += modalCoefficients[k] * V_ik * Math.cos(w_k * t);
        }
        
        const nextX = curX + scaleY * lengths[i] * Math.sin(angle);
        const nextY = curY + scaleY * lengths[i] * Math.cos(angle);
        
        // Draw string
        ctx.beginPath();
        ctx.moveTo(curX, curY);
        ctx.lineTo(nextX, nextY);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#aaa';
        ctx.stroke();
        
        // Draw bob
        ctx.beginPath();
        ctx.arc(nextX, nextY, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#00f0ff';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        curX = nextX;
        curY = nextY;
      }
      
      animationId = requestAnimationFrame(draw);
    };
    
    lastFrameTime.current = performance.now();
    animationId = requestAnimationFrame(draw);
    
    return () => cancelAnimationFrame(animationId);
  }, [data, isPlaying, lengths, modalCoefficients, n]);

  return (
    <div className="container">
      <header>
        <h1>Normal Modes Simulator</h1>
        <p>Interactive n-coupled pendulums visualization with Playback & Sandbox</p>
      </header>
      
      <main className="main-content">
        <div className="controls-panel card">
          <h2>Physics Sandbox</h2>
          
          <div className="playback-controls">
            <button onClick={() => setIsPlaying(!isPlaying)} className="btn-primary">
                {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button onClick={() => { timeRef.current = 0; setIsPlaying(false); }} className="btn-secondary">
                ⏹ Reset Time
            </button>
          </div>
          
          <div className="control-group" style={{marginTop: '1.5rem'}}>
            <label>N (Number of Pendulums): {n}</label>
            <input type="range" min="1" max="10" value={n} onChange={handleNChange} />
          </div>

          <div className="control-group">
            <label>Gravity (g): {g.toFixed(2)} m/s²</label>
            <input type="range" min="1.0" max="25.0" step="0.1" value={g} onChange={(e) => {
                const val = parseFloat(e.target.value);
                setG(val);
                requestUpdate(n, lengths, val);
            }} />
          </div>
          
          <div className="scroll-panel">
              <h3>Pendulum States</h3>
              {lengths.map((l, i) => (
                  <div key={i} className="pendulum-config">
                      <h4>Pendulum {i+1}</h4>
                      <div className="control-group small">
                          <label>Initial Angle: {(initialAngles[i] * 180 / Math.PI).toFixed(1)}°</label>
                          <input type="range" min="-1.5" max="1.5" step="0.05" value={initialAngles[i]} 
                              onChange={(e) => handleAngleChange(i, parseFloat(e.target.value))} />
                      </div>
                      <div className="control-group small">
                          <label>Segment Length: {l.toFixed(2)}m</label>
                          <input type="range" min="0.1" max="2.0" step="0.05" value={l} 
                              onChange={(e) => handleLengthChange(i, parseFloat(e.target.value))} />
                      </div>
                  </div>
              ))}
          </div>
          
          {error && <div className="error">{error}</div>}
        </div>
        
        <div className="canvas-panel card">
          <canvas ref={canvasRef} width={600} height={700}></canvas>
        </div>
      </main>
    </div>
  );
}

export default App;

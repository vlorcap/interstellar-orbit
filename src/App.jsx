import React, { useState, useEffect, useRef } from 'react';

// Quantum state class for calculations
class QubitState {
  constructor(alpha = { re: 1, im: 0 }, beta = { re: 0, im: 0 }) {
    this.alpha = alpha;
    this.beta = beta;
    this.normalize();
  }

  normalize() {
    const norm = Math.sqrt(
      this.alpha.re ** 2 + this.alpha.im ** 2 +
      this.beta.re ** 2 + this.beta.im ** 2
    );
    if (norm > 0) {
      this.alpha.re /= norm;
      this.alpha.im /= norm;
      this.beta.re /= norm;
      this.beta.im /= norm;
    }
  }

  // Convert to Bloch sphere coordinates
  toBlochCoordinates() {
    // θ (theta) from |alpha|^2
    const alphaMag2 = this.alpha.re ** 2 + this.alpha.im ** 2;
    const theta = 2 * Math.acos(Math.sqrt(alphaMag2));

    // φ (phi) from arg(beta/alpha)
    const betaPhase = Math.atan2(this.beta.im, this.beta.re);
    const alphaPhase = Math.atan2(this.alpha.im, this.alpha.re);
    const phi = betaPhase - alphaPhase;

    return {
      x: Math.sin(theta) * Math.cos(phi),
      y: Math.sin(theta) * Math.sin(phi),
      z: Math.cos(theta),
      theta,
      phi
    };
  }

  // Apply Hadamard gate
  applyHadamard() {
    const sqrt2 = Math.sqrt(2);
    const newAlpha = {
      re: (this.alpha.re + this.beta.re) / sqrt2,
      im: (this.alpha.im + this.beta.im) / sqrt2
    };
    const newBeta = {
      re: (this.alpha.re - this.beta.re) / sqrt2,
      im: (this.alpha.im - this.beta.im) / sqrt2
    };
    this.alpha = newAlpha;
    this.beta = newBeta;
    return this;
  }

  // Apply Pauli X gate (bit flip)
  applyPauliX() {
    const temp = { ...this.alpha };
    this.alpha = { ...this.beta };
    this.beta = temp;
    return this;
  }

  // Apply Pauli Y gate
  applyPauliY() {
    const temp = { re: this.alpha.re, im: this.alpha.im };
    this.alpha = { re: -this.beta.im, im: this.beta.re };
    this.beta = { re: temp.im, im: -temp.re };
    return this;
  }

  // Apply Pauli Z gate (phase flip)
  applyPauliZ() {
    this.beta.re = -this.beta.re;
    this.beta.im = -this.beta.im;
    return this;
  }

  // Measurement probabilities
  measureZ() {
    const prob0 = this.alpha.re ** 2 + this.alpha.im ** 2;
    const prob1 = this.beta.re ** 2 + this.beta.im ** 2;
    return { prob0, prob1 };
  }

  measureX() {
    // Transform to X basis: |+⟩ = (|0⟩ + |1⟩)/√2, |-⟩ = (|0⟩ - |1⟩)/√2
    const sqrt2 = Math.sqrt(2);
    const plusRe = (this.alpha.re + this.beta.re) / sqrt2;
    const plusIm = (this.alpha.im + this.beta.im) / sqrt2;
    const minusRe = (this.alpha.re - this.beta.re) / sqrt2;
    const minusIm = (this.alpha.im - this.beta.im) / sqrt2;

    return {
      probPlus: plusRe ** 2 + plusIm ** 2,
      probMinus: minusRe ** 2 + minusIm ** 2
    };
  }

  measureY() {
    // Transform to Y basis: |+i⟩ = (|0⟩ + i|1⟩)/√2, |-i⟩ = (|0⟩ - i|1⟩)/√2
    const sqrt2 = Math.sqrt(2);
    const plusIRe = (this.alpha.re - this.beta.im) / sqrt2;
    const plusIIm = (this.alpha.im + this.beta.re) / sqrt2;
    const minusIRe = (this.alpha.re + this.beta.im) / sqrt2;
    const minusIIm = (this.alpha.im - this.beta.re) / sqrt2;

    return {
      probPlusI: plusIRe ** 2 + plusIIm ** 2,
      probMinusI: minusIRe ** 2 + minusIIm ** 2
    };
  }

  clone() {
    return new QubitState(
      { ...this.alpha },
      { ...this.beta }
    );
  }
}

const BlochSphere = ({ qubitState }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const rotationRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    const coords = qubitState.toBlochCoordinates();

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Background gradient
      const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 2);
      bgGradient.addColorStop(0, 'rgba(10, 14, 39, 0.8)');
      bgGradient.addColorStop(1, 'rgba(10, 14, 39, 1)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      const rotation = rotationRef.current;
      rotationRef.current += 0.005;

      // 3D rotation matrices
      const rotateY = (x, y, z, angle) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
          x: x * cos + z * sin,
          y: y,
          z: -x * sin + z * cos
        };
      };

      const project = (x, y, z) => {
        const scale = 200 / (200 + z * 50);
        return {
          x: centerX + x * radius * scale,
          y: centerY - y * radius * scale,
          z: z
        };
      };

      // Draw wireframe sphere
      ctx.strokeStyle = 'rgba(26, 77, 122, 0.4)';
      ctx.lineWidth = 1;

      // Latitude lines
      for (let lat = -90; lat <= 90; lat += 30) {
        ctx.beginPath();
        for (let lon = 0; lon <= 360; lon += 10) {
          const theta = (90 - lat) * Math.PI / 180;
          const phi = lon * Math.PI / 180;
          let x = Math.sin(theta) * Math.cos(phi);
          let y = Math.sin(theta) * Math.sin(phi);
          let z = Math.cos(theta);

          const rotated = rotateY(x, y, z, rotation);
          const projected = project(rotated.x, rotated.y, rotated.z);

          if (lon === 0) {
            ctx.moveTo(projected.x, projected.y);
          } else {
            ctx.lineTo(projected.x, projected.y);
          }
        }
        ctx.stroke();
      }

      // Longitude lines
      for (let lon = 0; lon < 360; lon += 30) {
        ctx.beginPath();
        for (let lat = -90; lat <= 90; lat += 10) {
          const theta = (90 - lat) * Math.PI / 180;
          const phi = lon * Math.PI / 180;
          let x = Math.sin(theta) * Math.cos(phi);
          let y = Math.sin(theta) * Math.sin(phi);
          let z = Math.cos(theta);

          const rotated = rotateY(x, y, z, rotation);
          const projected = project(rotated.x, rotated.y, rotated.z);

          if (lat === -90) {
            ctx.moveTo(projected.x, projected.y);
          } else {
            ctx.lineTo(projected.x, projected.y);
          }
        }
        ctx.stroke();
      }

      // Draw axes
      const drawAxis = (x, y, z, color, label) => {
        const rotated = rotateY(x * 1.3, y * 1.3, z * 1.3, rotation);
        const projected = project(rotated.x, rotated.y, rotated.z);
        const origin = project(0, 0, 0);

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(projected.x, projected.y);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(projected.y - origin.y, projected.x - origin.x);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(projected.x, projected.y);
        ctx.lineTo(
          projected.x - 10 * Math.cos(angle - Math.PI / 6),
          projected.y - 10 * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          projected.x - 10 * Math.cos(angle + Math.PI / 6),
          projected.y - 10 * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.fillStyle = color;
        ctx.font = 'bold 16px Space Mono, monospace';
        ctx.fillText(label, projected.x + 10, projected.y - 10);
      };

      drawAxis(1, 0, 0, '#ff4444', 'X');
      drawAxis(0, 1, 0, '#44ff44', 'Y');
      drawAxis(0, 0, 1, '#4488ff', 'Z');

      // Draw state vector
      const stateRotated = rotateY(coords.x, coords.y, coords.z, rotation);
      const stateProjected = project(stateRotated.x, stateRotated.y, stateRotated.z);
      const origin = project(0, 0, 0);

      // State vector line
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(stateProjected.x, stateProjected.y);
      ctx.stroke();

      // State vector arrow
      const stateAngle = Math.atan2(stateProjected.y - origin.y, stateProjected.x - origin.x);
      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      ctx.moveTo(stateProjected.x, stateProjected.y);
      ctx.lineTo(
        stateProjected.x - 15 * Math.cos(stateAngle - Math.PI / 6),
        stateProjected.y - 15 * Math.sin(stateAngle - Math.PI / 6)
      );
      ctx.lineTo(
        stateProjected.x - 15 * Math.cos(stateAngle + Math.PI / 6),
        stateProjected.y - 15 * Math.sin(stateAngle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // State vector endpoint (glowing sphere)
      const gradient = ctx.createRadialGradient(
        stateProjected.x, stateProjected.y, 0,
        stateProjected.x, stateProjected.y, 15
      );
      gradient.addColorStop(0, 'rgba(255, 0, 255, 1)');
      gradient.addColorStop(0.5, 'rgba(255, 0, 255, 0.6)');
      gradient.addColorStop(1, 'rgba(255, 0, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(stateProjected.x, stateProjected.y, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      ctx.arc(stateProjected.x, stateProjected.y, 6, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [qubitState]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={500}
      className="w-full h-full"
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
};

const SuperpositionWaves = ({ qubitState }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, width, height);

      const time = timeRef.current;
      timeRef.current += 0.02;

      const centerY = height / 2;
      const waveHeight = 60;

      // Probabilities
      const prob0 = qubitState.alpha.re ** 2 + qubitState.alpha.im ** 2;
      const prob1 = qubitState.beta.re ** 2 + qubitState.beta.im ** 2;

      // Phase
      const phase0 = Math.atan2(qubitState.alpha.im, qubitState.alpha.re);
      const phase1 = Math.atan2(qubitState.beta.im, qubitState.beta.re);

      // Draw |0⟩ wave
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const y = centerY - waveHeight * Math.sqrt(prob0) * Math.sin((x * 0.02) + time + phase0);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw |1⟩ wave
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const y = centerY - waveHeight * Math.sqrt(prob1) * Math.sin((x * 0.02) + time + phase1);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw superposition (combined wave)
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const y0 = waveHeight * Math.sqrt(prob0) * Math.sin((x * 0.02) + time + phase0);
        const y1 = waveHeight * Math.sqrt(prob1) * Math.sin((x * 0.02) + time + phase1);
        const y = centerY - (y0 + y1) / 2;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Labels
      ctx.font = 'bold 14px Space Mono, monospace';
      ctx.fillStyle = '#a855f7';
      ctx.fillText('|0⟩', 10, 30);
      ctx.fillStyle = '#06b6d4';
      ctx.fillText('|1⟩', 10, 50);
      ctx.fillStyle = '#ff00ff';
      ctx.fillText('Superposición', 10, 70);

      // Center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [qubitState]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={200}
      className="w-full h-full"
    />
  );
};

export default function QuantumCalculator() {
  const [alphaRe, setAlphaRe] = useState('1');
  const [alphaIm, setAlphaIm] = useState('0');
  const [betaRe, setBetaRe] = useState('0');
  const [betaIm, setBetaIm] = useState('0');
  const [qubitState, setQubitState] = useState(new QubitState());
  const [measurements, setMeasurements] = useState(null);

  const updateState = () => {
    const alpha = { re: parseFloat(alphaRe) || 0, im: parseFloat(alphaIm) || 0 };
    const beta = { re: parseFloat(betaRe) || 0, im: parseFloat(betaIm) || 0 };
    const newState = new QubitState(alpha, beta);
    setQubitState(newState);
    setMeasurements(null);
  };

  useEffect(() => {
    updateState();
  }, [alphaRe, alphaIm, betaRe, betaIm]);

  const applyGate = (gateName) => {
    const newState = qubitState.clone();
    switch (gateName) {
      case 'H':
        newState.applyHadamard();
        break;
      case 'X':
        newState.applyPauliX();
        break;
      case 'Y':
        newState.applyPauliY();
        break;
      case 'Z':
        newState.applyPauliZ();
        break;
    }
    setQubitState(newState);
    setAlphaRe(newState.alpha.re.toFixed(4));
    setAlphaIm(newState.alpha.im.toFixed(4));
    setBetaRe(newState.beta.re.toFixed(4));
    setBetaIm(newState.beta.im.toFixed(4));
    setMeasurements(null);
  };

  const performMeasurement = (basis) => {
    let result;
    switch (basis) {
      case 'Z':
        result = qubitState.measureZ();
        setMeasurements({
          basis: 'Z',
          outcomes: ['|0⟩', '|1⟩'],
          probabilities: [result.prob0, result.prob1]
        });
        break;
      case 'X':
        result = qubitState.measureX();
        setMeasurements({
          basis: 'X',
          outcomes: ['|+⟩', '|-⟩'],
          probabilities: [result.probPlus, result.probMinus]
        });
        break;
      case 'Y':
        result = qubitState.measureY();
        setMeasurements({
          basis: 'Y',
          outcomes: ['|+i⟩', '|-i⟩'],
          probabilities: [result.probPlusI, result.probMinusI]
        });
        break;
    }
  };

  const formatComplex = (c) => {
    if (Math.abs(c.im) < 0.0001) return c.re.toFixed(3);
    if (Math.abs(c.re) < 0.0001) return `${c.im.toFixed(3)}i`;
    const sign = c.im >= 0 ? '+' : '';
    return `${c.re.toFixed(3)}${sign}${c.im.toFixed(3)}i`;
  };

  const coords = qubitState.toBlochCoordinates();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white p-8 font-['Space_Mono',monospace]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            QUANTUM CALCULATOR
          </h1>
          <p className="text-cyan-300/70 text-sm tracking-widest">ESFERA DE BLOCH · PUERTAS CUÁNTICAS · MEDICIONES</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left panel - Controls */}
          <div className="space-y-6">
            {/* State Input */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6 shadow-lg shadow-cyan-500/10">
              <h2 className="text-xl font-bold mb-4 text-cyan-400">ESTADO DEL QUBIT</h2>
              <div className="text-sm mb-4 text-gray-400">|ψ⟩ = α|0⟩ + β|1⟩</div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2 text-purple-300">Amplitud α (coeficiente de |0⟩)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        value={alphaRe}
                        onChange={(e) => setAlphaRe(e.target.value)}
                        className="w-full bg-slate-800/80 border border-purple-500/40 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-400 transition"
                        placeholder="Real"
                      />
                      <span className="text-xs text-gray-500 mt-1 block">Parte real</span>
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        value={alphaIm}
                        onChange={(e) => setAlphaIm(e.target.value)}
                        className="w-full bg-slate-800/80 border border-purple-500/40 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-400 transition"
                        placeholder="Imaginaria"
                      />
                      <span className="text-xs text-gray-500 mt-1 block">Parte imaginaria</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-2 text-pink-300">Amplitud β (coeficiente de |1⟩)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        value={betaRe}
                        onChange={(e) => setBetaRe(e.target.value)}
                        className="w-full bg-slate-800/80 border border-pink-500/40 rounded px-3 py-2 text-white focus:outline-none focus:border-pink-400 transition"
                        placeholder="Real"
                      />
                      <span className="text-xs text-gray-500 mt-1 block">Parte real</span>
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        value={betaIm}
                        onChange={(e) => setBetaIm(e.target.value)}
                        className="w-full bg-slate-800/80 border border-pink-500/40 rounded px-3 py-2 text-white focus:outline-none focus:border-pink-400 transition"
                        placeholder="Imaginaria"
                      />
                      <span className="text-xs text-gray-500 mt-1 block">Parte imaginaria</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quantum Gates */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6 shadow-lg shadow-cyan-500/10">
              <h2 className="text-xl font-bold mb-4 text-cyan-400">PUERTAS CUÁNTICAS</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => applyGate('H')}
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 py-3 px-4 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg shadow-purple-500/30"
                >
                  H
                  <span className="block text-xs font-normal mt-1">Hadamard</span>
                </button>
                <button
                  onClick={() => applyGate('X')}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 py-3 px-4 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg shadow-red-500/30"
                >
                  X
                  <span className="block text-xs font-normal mt-1">Pauli-X</span>
                </button>
                <button
                  onClick={() => applyGate('Y')}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 py-3 px-4 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg shadow-green-500/30"
                >
                  Y
                  <span className="block text-xs font-normal mt-1">Pauli-Y</span>
                </button>
                <button
                  onClick={() => applyGate('Z')}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 py-3 px-4 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg shadow-blue-500/30"
                >
                  Z
                  <span className="block text-xs font-normal mt-1">Pauli-Z</span>
                </button>
              </div>
            </div>

            {/* Measurements */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6 shadow-lg shadow-cyan-500/10">
              <h2 className="text-xl font-bold mb-4 text-cyan-400">MEDICIONES</h2>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <button
                  onClick={() => performMeasurement('Z')}
                  className="bg-blue-600/80 hover:bg-blue-500 py-3 px-4 rounded-lg font-bold transition-all shadow-lg"
                >
                  Medir Z
                </button>
                <button
                  onClick={() => performMeasurement('X')}
                  className="bg-red-600/80 hover:bg-red-500 py-3 px-4 rounded-lg font-bold transition-all shadow-lg"
                >
                  Medir X
                </button>
                <button
                  onClick={() => performMeasurement('Y')}
                  className="bg-green-600/80 hover:bg-green-500 py-3 px-4 rounded-lg font-bold transition-all shadow-lg"
                >
                  Medir Y
                </button>
              </div>

              {measurements && (
                <div className="bg-slate-800/60 rounded-lg p-4 border border-cyan-400/30">
                  <div className="text-sm font-bold mb-3 text-cyan-300">
                    Probabilidades en base {measurements.basis}:
                  </div>
                  {measurements.outcomes.map((outcome, idx) => (
                    <div key={idx} className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{outcome}</span>
                        <span className="text-purple-300">
                          {(measurements.probabilities[idx] * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${measurements.probabilities[idx] * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current State Display */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6 shadow-lg shadow-cyan-500/10">
              <h2 className="text-xl font-bold mb-4 text-cyan-400">ESTADO ACTUAL</h2>
              <div className="space-y-2 text-sm font-mono">
                <div className="text-purple-300">
                  |ψ⟩ = ({formatComplex(qubitState.alpha)})|0⟩ + ({formatComplex(qubitState.beta)})|1⟩
                </div>
                <div className="text-gray-400 text-xs pt-3 border-t border-slate-700">
                  <div>Coordenadas Bloch:</div>
                  <div className="mt-1">x = {coords.x.toFixed(3)}</div>
                  <div>y = {coords.y.toFixed(3)}</div>
                  <div>z = {coords.z.toFixed(3)}</div>
                </div>
              </div>
            </div>

            {/* Superposition Visualization */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6 shadow-lg shadow-cyan-500/10">
              <h2 className="text-xl font-bold mb-4 text-cyan-400">VISUALIZACIÓN DE SUPERPOSICIÓN</h2>

              {/* Probability amplitudes */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-purple-300 font-bold">Estado |0⟩</span>
                    <span className="text-xs text-gray-400">
                      P = {((qubitState.alpha.re ** 2 + qubitState.alpha.im ** 2) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Amplitude bars */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Real: {qubitState.alpha.re.toFixed(3)}</span>
                        <span>|α|² = {(qubitState.alpha.re ** 2 + qubitState.alpha.im ** 2).toFixed(3)}</span>
                      </div>
                      <div className="relative h-6 bg-slate-800 rounded-lg overflow-hidden">
                        <div
                          className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300"
                          style={{
                            width: `${Math.abs(qubitState.alpha.re) * 100}%`,
                            left: qubitState.alpha.re >= 0 ? '50%' : `${50 - Math.abs(qubitState.alpha.re) * 100}%`
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-0.5 h-full bg-white/30" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Imaginaria: {qubitState.alpha.im.toFixed(3)}</span>
                      </div>
                      <div className="relative h-6 bg-slate-800 rounded-lg overflow-hidden">
                        <div
                          className="absolute h-full bg-gradient-to-r from-pink-500 to-pink-600 transition-all duration-300"
                          style={{
                            width: `${Math.abs(qubitState.alpha.im) * 100}%`,
                            left: qubitState.alpha.im >= 0 ? '50%' : `${50 - Math.abs(qubitState.alpha.im) * 100}%`
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-0.5 h-full bg-white/30" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Phase visualization for alpha */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Fase:</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full relative overflow-hidden">
                      <div
                        className="absolute h-full w-1 bg-purple-400 transition-all duration-300"
                        style={{
                          left: `${((Math.atan2(qubitState.alpha.im, qubitState.alpha.re) + Math.PI) / (2 * Math.PI)) * 100}%`
                        }}
                      />
                    </div>
                    <span className="text-xs text-purple-400 font-mono w-16">
                      {(Math.atan2(qubitState.alpha.im, qubitState.alpha.re) * 180 / Math.PI).toFixed(0)}°
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-pink-300 font-bold">Estado |1⟩</span>
                    <span className="text-xs text-gray-400">
                      P = {((qubitState.beta.re ** 2 + qubitState.beta.im ** 2) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Amplitude bars */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Real: {qubitState.beta.re.toFixed(3)}</span>
                        <span>|β|² = {(qubitState.beta.re ** 2 + qubitState.beta.im ** 2).toFixed(3)}</span>
                      </div>
                      <div className="relative h-6 bg-slate-800 rounded-lg overflow-hidden">
                        <div
                          className="absolute h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-300"
                          style={{
                            width: `${Math.abs(qubitState.beta.re) * 100}%`,
                            left: qubitState.beta.re >= 0 ? '50%' : `${50 - Math.abs(qubitState.beta.re) * 100}%`
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-0.5 h-full bg-white/30" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Imaginaria: {qubitState.beta.im.toFixed(3)}</span>
                      </div>
                      <div className="relative h-6 bg-slate-800 rounded-lg overflow-hidden">
                        <div
                          className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                          style={{
                            width: `${Math.abs(qubitState.beta.im) * 100}%`,
                            left: qubitState.beta.im >= 0 ? '50%' : `${50 - Math.abs(qubitState.beta.im) * 100}%`
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-0.5 h-full bg-white/30" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Phase visualization for beta */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Fase:</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full relative overflow-hidden">
                      <div
                        className="absolute h-full w-1 bg-cyan-400 transition-all duration-300"
                        style={{
                          left: `${((Math.atan2(qubitState.beta.im, qubitState.beta.re) + Math.PI) / (2 * Math.PI)) * 100}%`
                        }}
                      />
                    </div>
                    <span className="text-xs text-cyan-400 font-mono w-16">
                      {(Math.atan2(qubitState.beta.im, qubitState.beta.re) * 180 / Math.PI).toFixed(0)}°
                    </span>
                  </div>
                </div>

                {/* Superposition indicator */}
                <div className="border-t border-slate-700 pt-4">
                  <div className="bg-slate-800/60 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-2">Estado de superposición:</div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 h-8 bg-gradient-to-r from-purple-600 to-cyan-600 rounded relative overflow-hidden">
                        <div
                          className="absolute inset-y-0 bg-white/20"
                          style={{
                            left: `${(qubitState.alpha.re ** 2 + qubitState.alpha.im ** 2) * 100}%`,
                            width: '2px'
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>|0⟩</span>
                      <span className="text-white">Superposición</span>
                      <span>|1⟩</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel - Bloch Sphere */}
          <div className="space-y-6">
            <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-6 shadow-lg shadow-purple-500/10">
              <h2 className="text-xl font-bold mb-4 text-purple-400">ESFERA DE BLOCH</h2>
              <div className="h-[500px] rounded-lg overflow-hidden border border-purple-500/20">
                <BlochSphere qubitState={qubitState} />
              </div>
            </div>

            {/* Superposition Waves */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-6 shadow-lg shadow-purple-500/10">
              <h2 className="text-xl font-bold mb-4 text-purple-400">ONDAS DE SUPERPOSICIÓN</h2>
              <div className="h-[200px] rounded-lg overflow-hidden border border-purple-500/20">
                <SuperpositionWaves qubitState={qubitState} />
              </div>
              <div className="mt-3 text-xs text-gray-400 text-center">
                <p>Las ondas muestran las amplitudes de |0⟩ (púrpura) y |1⟩ (cyan)</p>
                <p className="mt-1">La onda magenta representa la superposición resultante</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-gray-500 text-xs">
          <p>Visualización interactiva del espacio de estados de un qubit</p>
          <p className="mt-1">Las puertas cuánticas transforman el estado | Las mediciones colapsan la función de onda</p>
        </div>
      </div>
    </div>
  );
}

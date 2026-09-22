import React, { useState, useEffect, useRef } from 'react';
import { SKETCHFAB_CONFIG } from '../animation/animationConfig';
import WebGLDamWater from './WebGLDamWater';

/**
 * Linear 3D vector interpolation helper
 */
function lerp3(a, b, t) {
  if (!a || !b) return a || b || [0, 0, 0];
  return [
    parseFloat((a[0] + (b[0] - a[0]) * t).toFixed(3)),
    parseFloat((a[1] + (b[1] - a[1]) * t).toFixed(3)),
    parseFloat((a[2] + (b[2] - a[2]) * t).toFixed(3)),
  ];
}

const DEFAULT_KEYFRAMES = {
  pos1: {
    name: 'Position 1',
    position: [0.0, -80.0, 10.0],
    target: [0.0, 0.0, -5.0],
  },
  pos2: {
    name: 'Position 2',
    position: [-35.0, -55.0, 30.0],
    target: [5.0, 0.0, -5.0],
  },
  pos3: {
    name: 'Position 3',
    position: [-40.0, -45.0, 55.0],
    target: [0.0, 5.0, -10.0],
  },
};

export default function DamCameraDirector({ showWater = false, id = 'hero' }) {
  const iframeRef = useRef(null);
  const apiRef = useRef(null);
  const playTimerRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [currentCamera, setCurrentCamera] = useState({
    position: [0, 0, 0],
    target: [0, 0, 0],
  });

  // Stored keyframe positions (loaded from localStorage if user previously saved)
  const [pos1, setPos1] = useState(() => {
    try {
      const saved = localStorage.getItem('pralaya_saved_pos1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_KEYFRAMES.pos1;
  });

  const [pos2, setPos2] = useState(() => {
    try {
      const saved = localStorage.getItem('pralaya_saved_pos2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_KEYFRAMES.pos2;
  });

  const [pos3, setPos3] = useState(() => {
    try {
      const saved = localStorage.getItem('pralaya_saved_pos3');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_KEYFRAMES.pos3;
  });

  const [activeStage, setActiveStage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true); // Automatically active on load
  const [flightDuration, setFlightDuration] = useState(3.8);
  const [pauseDuration, setPauseDuration] = useState(2.0);
  const [statusMessage, setStatusMessage] = useState('Initializing 3D Dam Model...');
  const [copiedNotification, setCopiedNotification] = useState(false);

  const isPlayingRef = useRef(true);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Water flow state: Active ONLY in Position 3!
  const [isWaterActive, setIsWaterActive] = useState(false);
  const [showThread, setShowThread] = useState(false);

  // Update current camera from Sketchfab API
  const readCurrentCamera = (callback) => {
    if (apiRef.current) {
      apiRef.current.getCameraLookAt((err, cam) => {
        if (!err && cam) {
          const formatted = {
            position: cam.position.map((v) => parseFloat(v.toFixed(3))),
            target: cam.target.map((v) => parseFloat(v.toFixed(3))),
          };
          setCurrentCamera(formatted);
          if (callback) callback(formatted);
        }
      });
    }
  };

  // Automatic Keyframe Sequence Runner (Pos 1 -> Pos 2 -> Pos 3, then STOP at Position 3 and wait for scroll)
  const startSequence = (fromStage = 1) => {
    if (!apiRef.current) return;
    setIsPlaying(true);
    isPlayingRef.current = true;

    const runStep = (step) => {
      if (!isPlayingRef.current || !apiRef.current) return;

      const target =
        step === 1
          ? pos1 || DEFAULT_KEYFRAMES.pos1
          : step === 2
          ? pos2 || DEFAULT_KEYFRAMES.pos2
          : pos3 || DEFAULT_KEYFRAMES.pos3;

      setActiveStage(step);

      // Pos 1 & 2 are strictly dry
      if (step !== 3) {
        setIsWaterActive(false);
        setShowThread(false);
      }

      setStatusMessage(`Auto-Tour: Flying to Position ${step}... (${flightDuration}s)`);

      apiRef.current.setCameraLookAt(target.position, target.target, flightDuration, (err) => {
        if (!err && isPlayingRef.current) {
          readCurrentCamera(() => {
            if (step === 3) {
              // STOP AT POSITION 3! Do not loop infinitely. Wait for user scroll!
              setIsPlaying(false);
              isPlayingRef.current = false;
              if (showWater) setIsWaterActive(true);
              setStatusMessage('Position 3: Plunge Basin (Scroll down to explore inundation)');
              return; // Halt sequence at Position 3
            } else {
              setIsWaterActive(false);
              setStatusMessage(`Auto-Tour: Position ${step} Settled (Holding ${pauseDuration}s)`);

              if (playTimerRef.current) clearTimeout(playTimerRef.current);
              playTimerRef.current = setTimeout(() => {
                if (isPlayingRef.current) {
                  runStep(step + 1);
                }
              }, pauseDuration * 1000);
            }
          });
        }
      });
    };

    runStep(fromStage);
  };

  // Initialize Sketchfab Viewer & Automatically Trigger Transition Sequence on Load
  useEffect(() => {
    let isMounted = true;

    function initApi() {
      if (!window.Sketchfab || !iframeRef.current) {
        setTimeout(initApi, 200);
        return;
      }

      const client = new window.Sketchfab(iframeRef.current);
      client.init(SKETCHFAB_CONFIG.modelId, {
        autostart: 1,
        transparent: 1,
        ui_theme: 'dark',
        ui_infos: 0,
        ui_watermark: 0,
        ui_controls: 0,
        ui_help: 0,
        ui_settings: 0,
        ui_inspector: 0,
        ui_annotations: 0,
        ui_stop: 0,
        ui_hint: 0,
        scrollwheel: 0,
        double_click: 1,
        success: (api) => {
          if (!isMounted) return;
          apiRef.current = api;
          window.pralayaDamApi = api;

          api.start(() => {
            api.addEventListener('viewerready', () => {
              if (!isMounted) return;
              setIsReady(true);
              setIsPlaying(true);
              isPlayingRef.current = true;
              setStatusMessage('3D Dam Ready — Auto-Tour Triggered');

              try {
                api.setBackground({ color: [0.063, 0.098, 0.09] }, () => {});
              } catch {}

              // AUTOMATICALLY TRIGGER THE TRANSITION SEQUENCE AS SOON AS 3D MODEL LOADS!
              setTimeout(() => {
                if (isMounted) {
                  startSequence(1);
                }
              }, 400);

              // Update camera coordinates whenever user stops moving camera
              api.addEventListener('camerastop', () => {
                readCurrentCamera();
              });
            });
          });
        },
        error: () => {
          setStatusMessage('Error initializing Sketchfab 3D API');
        },
      });
    }

    initApi();

    return () => {
      isMounted = false;
      isPlayingRef.current = false;
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    };
  }, []);

  // Animate smoothly to specific keyframe (manual click pauses auto-sequence)
  const flyToPos = (stageNum) => {
    if (!apiRef.current) return;
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setActiveStage(stageNum);

    let target = DEFAULT_KEYFRAMES.pos1;
    if (stageNum === 1) target = pos1;
    if (stageNum === 2) target = pos2;
    if (stageNum === 3) target = pos3;

    if (stageNum !== 3) {
      setIsWaterActive(false);
      setShowThread(false);
    }

    setStatusMessage(`Manual: Flying to Position ${stageNum}... (${flightDuration}s)`);

    apiRef.current.setCameraLookAt(target.position, target.target, flightDuration, (err) => {
      if (!err) {
        readCurrentCamera(() => {
          if (stageNum === 3) {
            if (showWater) setIsWaterActive(true);
            setStatusMessage(`Position 3 Arrived | cam: [${target.position.join(', ')}]`);
          } else {
            setIsWaterActive(false);
            setStatusMessage(`Position ${stageNum} Active | cam: [${target.position.join(', ')}]`);
          }
        });
      }
    });
  };

  // Play / Pause Sequence toggle
  const togglePlaySequence = () => {
    if (isPlaying) {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      setIsPlaying(false);
      isPlayingRef.current = false;
      setStatusMessage('Sequence Paused (Manual Inspection)');
    } else {
      setIsPlaying(true);
      isPlayingRef.current = true;
      startSequence(1);
    }
  };

  // Save current camera view into specified position slot
  const saveCurrentView = (stageNum) => {
    readCurrentCamera((cam) => {
      const newPos = {
        name: `Position ${stageNum}`,
        position: [...cam.position],
        target: [...cam.target],
      };

      if (stageNum === 1) {
        setPos1(newPos);
        try {
          localStorage.setItem('pralaya_saved_pos1', JSON.stringify(newPos));
        } catch {}
      } else if (stageNum === 2) {
        setPos2(newPos);
        try {
          localStorage.setItem('pralaya_saved_pos2', JSON.stringify(newPos));
        } catch {}
      } else if (stageNum === 3) {
        setPos3(newPos);
        try {
          localStorage.setItem('pralaya_saved_pos3', JSON.stringify(newPos));
        } catch {}
      }

      setStatusMessage(`Saved current camera to Position ${stageNum}!`);
      setTimeout(() => {
        setStatusMessage(`Position ${stageNum} Ready`);
      }, 2000);
    });
  };

  // Copy all 3 positions to clipboard
  const copyPositions = () => {
    const configCode = `// Saved Camera Keyframes for Machhu-II Dam (3.8s fly, 2s delay)
export const SAVED_POSITIONS = {
  pos1: ${JSON.stringify(pos1, null, 2)},
  pos2: ${JSON.stringify(pos2, null, 2)},
  pos3: ${JSON.stringify(pos3, null, 2)},
};`;

    navigator.clipboard.writeText(configCode).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  return (
    <div
      id={id}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: '#101917',
        userSelect: 'none',
        fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* 1. Fullscreen 3D Dam Viewport with 100% Free Mouse Interaction */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
      >
        <iframe
          ref={iframeRef}
          id="api-frame"
          title="Machhu-II Dam 3D Model"
          frameBorder="0"
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            pointerEvents: 'auto',
            background: '#101917',
          }}
        />
      </div>

      {/* 2. WebGL Dynamic Architecture-Conforming Water Simulation (Active at Position 3 when showWater is enabled) */}
      {showWater && (
        <WebGLDamWater
          activeStage={activeStage}
          isWaterActive={isWaterActive}
          showThread={showThread}
          onToggleThread={() => setShowThread((prev) => !prev)}
        />
      )}

      {/* 3. Floating Editorial Narrative HUD on Left */}
      <div
        style={{
          position: 'absolute',
          top: '52%',
          left: 'clamp(20px, 4vw, 56px)',
          transform: 'translateY(-50%)',
          zIndex: 40,
          maxWidth: '440px',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            background: 'rgba(10, 18, 20, 0.88)',
            border: '1px solid rgba(78, 205, 196, 0.3)',
            borderRadius: '16px',
            padding: '24px 28px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#4ecdc4',
                boxShadow: '0 0 8px #4ecdc4',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '10px',
                letterSpacing: '0.14em',
                color: '#4ecdc4',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              SCENE 01 // THE CALM · 3D DIGITAL TWIN
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif, "Cinzel", serif)',
              fontSize: '32px',
              fontWeight: 600,
              lineHeight: 1.15,
              color: '#f1faee',
              marginBottom: '12px',
              letterSpacing: '-0.02em',
            }}
          >
            Understand <br />
            <em style={{ fontStyle: 'italic', color: '#a8dadc' }}>the Breach.</em>
          </h1>

          <p
            style={{
              fontSize: '13.5px',
              lineHeight: 1.65,
              color: '#a7b6a9',
              marginBottom: '18px',
            }}
          >
            Explore dam-breach inundation hydraulics through calibrated 3D visualization. Orbit the
            Machhu-II dam structure freely or run the choreographed camera flight.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href="#breach"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.3) 0%, rgba(46, 213, 115, 0.25) 100%)',
                border: '1px solid #4ecdc4',
                color: '#f0f4ef',
                fontSize: '11.5px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              EXPLORE INUNDATION ↓
            </a>
            <button
              type="button"
              onClick={togglePlaySequence}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#a7b6a9',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isPlaying ? '⏸ PAUSE TOUR' : '▶ 3-POS TOUR'}
            </button>
          </div>

          {/* Telemetry metadata */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px 16px',
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(167, 182, 169, 0.15)',
            }}
          >
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#636e72', letterSpacing: '0.08em' }}>
                LOCATION
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f0f4ef' }}>Morbi, Gujarat, India</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#636e72', letterSpacing: '0.08em' }}>
                COORDINATES
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#4ecdc4' }}>22.82°N, 70.84°E</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#636e72', letterSpacing: '0.08em' }}>
                PEAK INFLOW (1979)
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#ff6b6b' }}>13,570 m³/s (218%)</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#636e72', letterSpacing: '0.08em' }}>
                FLOOD WAVE HEIGHT
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f4a261' }}>8 – 10 Meters</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

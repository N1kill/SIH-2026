import React, { useState, useEffect, useRef } from 'react';
import { SKETCHFAB_CONFIG } from '../animation/animationConfig';
import WebGLDamWater from './WebGLDamWater';
import EngineeringTwin3D from './EngineeringTwin3D';

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

export default function DamCameraDirector({ initialWater = false, id = 'hero' }) {
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
  const [isPlaying, setIsPlaying] = useState(true);
  const [flightDuration, setFlightDuration] = useState(3.8);
  const [pauseDuration, setPauseDuration] = useState(2.0);
  const [statusMessage, setStatusMessage] = useState('3D Dam Model Active — Tour Starting...');
  const [copiedNotification, setCopiedNotification] = useState(false);

  const isPlayingRef = useRef(true);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Water simulation toggle state: Strictly OFF by default!
  const [waterEnabled, setWaterEnabled] = useState(initialWater);
  const [showThread, setShowThread] = useState(false);
  // View mode: 'flight' (Sketchfab drone flight) vs 'twin' (3D Engineering Twin with 18 gates & Delft3D mesh)
  const [engineMode, setEngineMode] = useState('flight');
  const [isHudMinimized, setIsHudMinimized] = useState(false);

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
      setStatusMessage(`Auto-Tour: Flying to Position ${step}... (${flightDuration}s)`);

      apiRef.current.setCameraLookAt(target.position, target.target, flightDuration, (err) => {
        if (!err && isPlayingRef.current) {
          readCurrentCamera(() => {
            if (step >= 3) {
              // STOP AT POSITION 3! Do not loop infinitely. Wait for user scroll!
              setIsPlaying(false);
              isPlayingRef.current = false;
              setStatusMessage('Position 3: Plunge Basin (Scroll down to explore inundation)');
              return; // Halt sequence at Position 3
            } else {
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
              setStatusMessage('3D Dam Model Ready — Initializing Flight...');

              try {
                api.setBackground({ color: [0.063, 0.098, 0.09] }, () => {});
              } catch {}

              const target = pos1 || DEFAULT_KEYFRAMES.pos1;
              api.setCameraLookAt(target.position, target.target, 0.5, () => {
                readCurrentCamera();
                // Automatically run sequence Pos 1 -> Pos 2 -> Pos 3 on load
                if (playTimerRef.current) clearTimeout(playTimerRef.current);
                playTimerRef.current = setTimeout(() => {
                  if (isMounted) {
                    startSequence(1);
                  }
                }, 600);
              });

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

    setStatusMessage(`Manual: Flying to Position ${stageNum}... (${flightDuration}s)`);

    apiRef.current.setCameraLookAt(target.position, target.target, flightDuration, (err) => {
      if (!err) {
        readCurrentCamera(() => {
          setStatusMessage(`Position ${stageNum} Active | cam: [${target.position.join(', ')}]`);
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
      {/* 1. Viewport: 3D Engineering Twin (18 gates, breach collapse, Delft3D flexible mesh) */}
      {engineMode === 'twin' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
          }}
        >
          <EngineeringTwin3D height="100%" />
        </div>
      )}

      {/* 2. Viewport: Photogrammetry Dam Model with Keyframe Flight Director */}
      {engineMode === 'flight' && (
        <>
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

          {/* WebGL Dynamic Water Simulation (Strictly OFF by default, rendered only when user toggles ON) */}
          {waterEnabled && (
            <WebGLDamWater
              activeStage={activeStage}
              isWaterActive={true}
              showThread={showThread}
              onToggleThread={() => setShowThread((prev) => !prev)}
            />
          )}
        </>
      )}

      {/* 3. Floating Editorial Narrative HUD on Left */}
      <div
        style={{
          position: 'absolute',
          top: engineMode === 'twin' ? 'auto' : '52%',
          bottom: engineMode === 'twin' ? '24px' : 'auto',
          left: 'clamp(20px, 4vw, 56px)',
          transform: engineMode === 'twin' ? 'none' : 'translateY(-50%)',
          zIndex: 40,
          maxWidth: engineMode === 'twin' ? '380px' : '440px',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {isHudMinimized ? (
          <button
            type="button"
            onClick={() => setIsHudMinimized(false)}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(10, 18, 20, 0.92)',
              border: '1px solid rgba(78, 205, 196, 0.4)',
              borderRadius: '8px',
              padding: '8px 14px',
              color: '#81e6d9',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}
          >
            ↗ SHOW NARRATIVE HUD
          </button>
        ) : (
          <div
            style={{
              background: 'rgba(10, 18, 20, 0.92)',
              border: '1px solid rgba(78, 205, 196, 0.3)',
              borderRadius: '16px',
              padding: '20px 24px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75)',
              pointerEvents: 'auto',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setIsHudMinimized(true)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono, monospace)',
              }}
              title="Minimize HUD"
            >
              ✕ HIDE
            </button>

            <h1
              style={{
                fontFamily: 'var(--font-serif, "Cinzel", serif)',
                fontSize: '28px',
                fontWeight: 600,
                lineHeight: 1.15,
                color: '#f1faee',
                marginBottom: '10px',
                letterSpacing: '-0.02em',
              }}
            >
              Understand <br />
              <em style={{ fontStyle: 'italic', color: '#a8dadc' }}>the Breach.</em>
            </h1>

            <p
              style={{
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#a7b6a9',
                marginBottom: '14px',
              }}
            >
              {engineMode === 'twin'
                ? '3D Engineering Twin active. Orbit freely, hoist 18 radial gates, simulate structural breach, and scrub Delft3D-FM flexible mesh velocity vectors.'
                : 'Explore dam-breach inundation hydraulics through calibrated 3D visualization. Orbit freely or run the choreographed camera flight.'}
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a
                href="#breach"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.3) 0%, rgba(46, 213, 115, 0.25) 100%)',
                  border: '1px solid #4ecdc4',
                  color: '#f0f4ef',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                EXPLORE INUNDATION ↓
              </a>
              {engineMode === 'flight' && (
                <button
                  type="button"
                  onClick={togglePlaySequence}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#a7b6a9',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
              )}

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%', marginTop: '4px', flexWrap: 'wrap' }}>
                {/* 3D Engine Mode Switcher */}
                <button
                  type="button"
                  onClick={() => setEngineMode((prev) => (prev === 'flight' ? 'twin' : 'flight'))}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: '6px',
                    border: '1px solid ' + (engineMode === 'twin' ? '#38bdf8' : 'rgba(78, 205, 196, 0.35)'),
                    background: engineMode === 'twin' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: engineMode === 'twin' ? '#38bdf8' : '#7dd3fc',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono, monospace)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                  }}
                  title="Switch between Cinematic Drone Flight and Interactive 3D Engineering Twin"
                >
                  <span>3D VIEW ENGINE:</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '8px',
                      background: engineMode === 'twin' ? '#0284c7' : 'rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '9.5px',
                      fontWeight: 700,
                    }}
                  >
                    {engineMode === 'twin' ? '⚙ 3D ENGINEERING TWIN' : '🛩 CINEMATIC DRONE'}
                  </span>
                </button>

                {/* Explicit Water Toggle Switch (Only in flight mode) */}
                {engineMode === 'flight' && (
                  <button
                    type="button"
                    onClick={() => setWaterEnabled((prev) => !prev)}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid ' + (waterEnabled ? '#38bdf8' : 'rgba(255, 255, 255, 0.18)'),
                      background: waterEnabled ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      color: waterEnabled ? '#38bdf8' : '#8d99ae',
                      fontSize: '10.5px',
                      fontFamily: 'var(--font-mono, monospace)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                    }}
                    title="Toggle optional water overlay for spillway"
                  >
                    <span>WATER SIMULATION:</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '8px',
                        background: waterEnabled ? '#0284c7' : 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        fontSize: '9.5px',
                        fontWeight: 700,
                      }}
                    >
                      {waterEnabled ? 'ON ●' : 'OFF ○'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

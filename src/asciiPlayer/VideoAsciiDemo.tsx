import React, { useState, useRef, useEffect } from 'react';

// VideoAsciiPlayer 類別（內嵌版本）
interface VideoAsciiPlayerOptions {
  chars?: string;
  step?: number;
  threshold?: number;
}

class VideoAsciiPlayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private chars: string;
  private step: number;
  private threshold: number;
  private currentVideo: HTMLVideoElement | null = null;
  private data: string[][] = [];
  private animationFrameId: number | null = null;
  private onFrameCallback: ((frame: string[][]) => void) | null = null;
  private invert: boolean = false;

  constructor(options: VideoAsciiPlayerOptions = {}) {
    this.chars = options.chars ?? '@%#*+=-:. ';
    this.step = options.step ?? 2;
    this.threshold = options.threshold ?? Math.floor(255 * ((this.chars.length - 1) / this.chars.length));
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
  }

  setStep(n: number) {
    this.step = Math.max(1, Math.floor(n));
  }

  async loadVideo(src: string): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      if (!src.startsWith('data:') && !src.startsWith('blob:')) {
        video.crossOrigin = 'anonymous';
      }
      video.onloadedmetadata = () => resolve(video);
      video.onerror = () => reject(new Error('影片載入失敗'));
      video.src = src;
      video.load();
    });
  }

  setVideo(video: HTMLVideoElement) {
    this.currentVideo = video;
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
  }

  async loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!src.startsWith('data:') && !src.startsWith('blob:')) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('圖片載入失敗'));
      img.src = src;
    });
  }

  setImage(img: HTMLImageElement) {
    this.currentVideo = null;
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    this.ctx.drawImage(img, 0, 0, img.width, img.height);
  }

  processImage() {
    this.computeAsciiFromCanvas();
  }

  setInvert(v: boolean) {
    this.invert = !!v;
  }

  play(onFrame?: (frame: string[][]) => void) {
    if (!this.currentVideo) throw new Error('No video loaded. Call setVideo() first.');
    this.onFrameCallback = onFrame || null;
    this.currentVideo.play();
    this.startRendering();
  }

  pause() {
    this.currentVideo?.pause();
    this.stopRendering();
  }

  stop() {
    if (this.currentVideo) {
      this.currentVideo.pause();
      this.currentVideo.currentTime = 0;
    }
    this.stopRendering();
  }

  private startRendering() {
    const render = () => {
      if (this.currentVideo && !this.currentVideo.paused) {
        this.updateAsciiData();
        if (this.onFrameCallback) this.onFrameCallback(this.data);
        this.animationFrameId = requestAnimationFrame(render);
      }
    };
    render();
  }

  private stopRendering() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  getAsciiFrame(): string[][] {
    if (this.currentVideo) {
      this.updateAsciiData();
    } else {
      this.computeAsciiFromCanvas();
    }
    return this.data;
  }

  private updateAsciiData() {
    const video = this.currentVideo;
    if (!video) return;
    const { videoWidth: w, videoHeight: h } = video;
    this.ctx.drawImage(video, 0, 0, w, h);
    this.computeAsciiFromCanvas();
  }

  private computeAsciiFromCanvas() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const img = this.ctx.getImageData(0, 0, w, h).data;
    const arr: string[][] = [];
    for (let y = 0; y < h; y += this.step) {
      const row: string[] = [];
      for (let x = 0; x < w; x += this.step) {
        let sum = 0;
        for (let dy = 0; dy < this.step; dy++) {
          for (let dx = 0; dx < this.step; dx++) {
            const py = y + dy;
            const px = x + dx;
            if (py < h && px < w) {
              const idx = (py * w + px) * 4;
              sum += img[idx];
            }
          }
        }
        let avg = sum / (this.step * this.step);
        if (this.invert) avg = 255 - avg;
        const avg2 = avg > this.threshold ? 255 : avg;
        const idx = Math.floor((avg2 / 255) * (this.chars.length - 1));
        row.push(this.chars[idx]);
      }
      arr.push(row);
    }
    this.data = arr;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getVideo(): HTMLVideoElement | null {
    return this.currentVideo;
  }

  isPlaying(): boolean {
    return this.currentVideo ? !this.currentVideo.paused : false;
  }

  destroy() {
    this.stop();
    this.currentVideo = null;
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.data = [];
    this.onFrameCallback = null;
  }
}

// React 測試組件
export default function VideoAsciiDemo() {
  const [asciiFrame, setAsciiFrame] = useState<string[][]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState(3);
  const [useTargetCols, setUseTargetCols] = useState(false);
  const [targetCols, setTargetCols] = useState(80);
  const [computedStepFromCols, setComputedStepFromCols] = useState<number | null>(null);
  const [chars, setChars] = useState('@%#*+=-:. ');
  const playerRef = useRef<VideoAsciiPlayer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const asciiContainerRef = useRef<HTMLDivElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const scaleX = 2;
  const [invert, setInvert] = useState(false);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!useTargetCols) {
      setComputedStepFromCols(null);
      return;
    }
    const player = playerRef.current;
    if (!player) return;

    let imgW = 0;
    const v = (player as any).getVideo ? (player as any).getVideo() : null;
    if (v && v.videoWidth) imgW = v.videoWidth;
    else if ((player as any).getCanvas) {
      const c = (player as any).getCanvas();
      if (c) imgW = c.width;
    }
    if (!imgW) return;

    const newStep = Math.max(1, Math.round(imgW / Math.max(1, targetCols)));
    setComputedStepFromCols(newStep);
    setStep(newStep);
    if ((player as any).setStep) (player as any).setStep(newStep);

    // reprocess immediate frame
    if ((player as any).processImage) {
      try {
        (player as any).processImage();
        const f = (player as any).getAsciiFrame();
        if (f) setAsciiFrame(f);
      } catch (e) {}
    } else if ((player as any).getAsciiFrame) {
      try {
        const f = (player as any).getAsciiFrame();
        if (f) setAsciiFrame(f);
      } catch (e) {}
    }
  }, [useTargetCols, targetCols, isLoading]);

  // 固定使用 scaleX = 2，不再自動計算

  const loadDemoVideo = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const player = new VideoAsciiPlayer({ step, chars });
      
      // 使用更可靠的影片來源
      const videoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
      
      console.log('Loading video from:', videoUrl);
      const video = await player.loadVideo(videoUrl);
      
      player.setVideo(video);
      player.setInvert(invert);
      playerRef.current?.destroy();
      playerRef.current = player;
      
      player.play((frame) => {
        setAsciiFrame(frame);
        setIsPlaying(true);
      });
      
      console.log('Video loaded successfully');
    } catch (err) {
      console.error('Load error:', err);
      setError('載入影片失敗: ' + ((err as Error).message || '請檢查網路連線或嘗試上傳本地影片'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomVideo = async (file: File) => {
    setIsLoading(true);
    setError('');
    
    try {
      // 檢查檔案類型
      if (!file.type.startsWith('video/')) {
        throw new Error('請選擇影片檔案 (MP4, WebM, MOV 等)');
      }
      
      console.log('Loading custom video:', file.name, file.type);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const src = e.target?.result as string;
          const player = new VideoAsciiPlayer({ step, chars });
          const video = await player.loadVideo(src);
          
              player.setVideo(video);
              player.setInvert(invert);
          playerRef.current?.destroy();
          playerRef.current = player;
          
          player.play((frame) => {
            setAsciiFrame(frame);
            setIsPlaying(true);
          });
          
          console.log('Custom video loaded successfully');
          setIsLoading(false);
        } catch (err) {
          console.error('Video load error:', err);
          setError('載入影片失敗: ' + ((err as Error).message || '檔案格式可能不支援'));
          setIsLoading(false);
        }
      };
      
      reader.onerror = () => {
        setError('讀取檔案失敗，請重試');
        setIsLoading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File handling error:', err);
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  const loadImageFile = async (file: File) => {
    setIsLoading(true);
    setError('');
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('請選擇圖片檔案 (PNG, JPG, WebP 等)');
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const src = e.target?.result as string;
          const player = new VideoAsciiPlayer({ step, chars });
          const img = await player.loadImage(src);

          player.setImage(img);
          player.setInvert(invert);
          playerRef.current?.destroy();
          playerRef.current = player;

          // process image once and display
          player.processImage();
          const frame = player.getAsciiFrame();
          setAsciiFrame(frame);
          setIsPlaying(false);
          setIsLoading(false);
        } catch (err) {
          console.error('Image load error:', err);
          setError('載入圖片失敗: ' + ((err as Error).message || '檔案可能不支援'));
          setIsLoading(false);
        }
      };
      reader.onerror = () => {
        setError('讀取檔案失敗，請重試');
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File handling error:', err);
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  // 只有在內容寬或高超出容器時才縮放
  useEffect(() => {
    const updateFit = () => {
      const container = asciiContainerRef.current;
      const preEl = preRef.current;
      if (!container || !preEl) {
        setFitScale(1);
        return;
      }

      const cW = Math.max(0, container.clientWidth - 8);
      const cH = Math.max(0, container.clientHeight - 8);

      // compute visual size: account for pre's horizontal transform scaleX
      const pW = (preEl.offsetWidth || preEl.clientWidth) * scaleX;
      const pH = preEl.offsetHeight || preEl.clientHeight;
      if (!pW || !pH) {
        setFitScale(1);
        return;
      }
      // 若都沒有超出，維持 1，不做縮放（只要寬或高任一超過就縮放）
      if (pW <= cW && pH <= cH) {
        setFitScale(1);
        return;
      }

      const s = Math.min(cW / pW, cH / pH);
      const clamped = Math.max(0.1, Math.min(1, s));
      setFitScale(prev => (Math.abs(prev - clamped) > 0.01 ? clamped : prev));
    };

    requestAnimationFrame(updateFit);
    const onResize = () => requestAnimationFrame(updateFit);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [asciiFrame, scaleX]);

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    
    if (isPlaying) {
      playerRef.current.pause();
      setIsPlaying(false);
    } else {
      playerRef.current.play((frame) => {
        setAsciiFrame(frame);
      });
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    playerRef.current?.stop();
    setIsPlaying(false);
    setAsciiFrame([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadCustomVideo(file);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#39ff66', padding: '32px', fontFamily: 'monospace' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, marginBottom: 16, textAlign: 'center' }}>🎬 Video ASCII Player 測試</h1>

        {/* 控制面板 */}
        <div style={{ background: '#0b0b0b', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid #2f8f66' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>解析度 (step): {step}</label>
              <input
                type="range"
                min="1"
                max="10"
                value={step}
                onChange={(e) => setStep(Number(e.target.value))}
                style={{ width: '100%' }}
                disabled={isPlaying}
              />
              <span style={{ fontSize: 12, color: '#9ca3a8' }}>數字越小，細節越多（但較慢）</span>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ color: '#9ca3a8' }}>以目標字寬計算:</label>
                <input
                  type="number"
                  min={10}
                  max={200}
                  value={targetCols}
                  onChange={(e) => setTargetCols(Number(e.target.value) || 0)}
                  style={{ width: 80, padding: '4px 6px', borderRadius: 4 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={useTargetCols} onChange={(e) => setUseTargetCols(e.target.checked)} /> 使用
                </label>
                <div style={{ color: '#9ca3a8' }}>計算 step: {computedStepFromCols ?? '-'}</div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>ASCII 字元集:</label>
              <input
                type="text"
                value={chars}
                onChange={(e) => setChars(e.target.value)}
                style={{ width: '100%', background: '#000', border: '1px solid #2f8f66', padding: 8, borderRadius: 4, color: '#39ff66' }}
                disabled={isPlaying}
              />
              <span style={{ fontSize: 12, color: '#9ca3a8' }}>從暗到亮排列</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={loadDemoVideo}
              disabled={isLoading || isPlaying}
              style={{ padding: '8px 12px', background: '#2f8f66', color: '#000', borderRadius: 6, cursor: 'pointer', opacity: isLoading || isPlaying ? 0.6 : 1 }}
            >
              {isLoading ? '載入中...' : '📺 載入示範影片'}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isPlaying}
              style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', borderRadius: 6, cursor: 'pointer', opacity: isLoading || isPlaying ? 0.6 : 1 }}
            >
              📁 上傳自訂影片
            </button>

            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isLoading || isPlaying}
              style={{ padding: '8px 12px', background: '#945dd6', color: '#fff', borderRadius: 6, cursor: 'pointer', opacity: isLoading || isPlaying ? 0.6 : 1 }}
            >
              🖼️ 載入圖片
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadImageFile(file);
              }}
              style={{ display: 'none' }}
            />

            <button
              onClick={handlePlayPause}
              disabled={!playerRef.current}
              style={{ padding: '8px 12px', background: '#f59e0b', color: '#000', borderRadius: 6, cursor: 'pointer', opacity: !playerRef.current ? 0.6 : 1 }}
            >
              {isPlaying ? '⏸️ 暫停' : '▶️ 播放'}
            </button>

            <button
              onClick={handleStop}
              disabled={!playerRef.current}
              style={{ padding: '8px 12px', background: '#dc2626', color: '#fff', borderRadius: 6, cursor: 'pointer', opacity: !playerRef.current ? 0.6 : 1 }}
            >
              ⏹️ 停止
            </button>
            <button
              onClick={() => {
                const next = !invert;
                setInvert(next);
                if (playerRef.current) {
                  playerRef.current.setInvert(next);
                  try {
                    const frame = playerRef.current.getAsciiFrame();
                    setAsciiFrame(frame);
                  } catch (e) {}
                }
              }}
              style={{ padding: '8px 12px', background: invert ? '#ffffff' : '#111827', color: invert ? '#000' : '#fff', borderRadius: 6, cursor: 'pointer' }}
            >
              反轉亮度
            </button>
            
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: 12, background: '#4c0505', border: '1px solid #7f1d1d', borderRadius: 6, color: '#fca5a5' }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* ASCII 顯示區 */}
        <div ref={asciiContainerRef} style={{ background: '#000', border: '2px solid #2f8f66', borderRadius: 8, padding: 12, overflow: 'hidden', maxHeight: '60vh' }}>
          {asciiFrame.length > 0 ? (
            <div style={{ transform: `scale(${fitScale})`, transformOrigin: 'left top' }}>
              <pre ref={preRef} style={{ fontSize: 8, lineHeight: '8px', whiteSpace: 'pre', letterSpacing: 0, margin: 0, display: 'inline-block', transform: `scaleX(${scaleX})`, transformOrigin: 'left top' }}>
                {asciiFrame.map((row, i) => (
                  <div key={i}>{row.join('')}</div>
                ))}
              </pre>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3a8' }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>🎥</p>
              <p>請載入影片開始播放</p>
            </div>
          )}
        </div>

        {/* 資訊 */}
        <div style={{ marginTop: 16, textAlign: 'center', color: '#9ca3a8', fontSize: 13 }}>
          <p>解析度: {asciiFrame[0]?.length || 0} x {asciiFrame.length || 0} 字元</p>
          <p style={{ marginTop: 8 }}>💡 提示: 解析度調低 (step=1-2) 可看到更多細節，但會較慢</p>
          <p style={{ marginTop: 6, fontSize: 12 }}>🐛 如果示範影片無法載入，請嘗試上傳本地 MP4 檔案</p>
        </div>
      </div>
    </div>
  );
}

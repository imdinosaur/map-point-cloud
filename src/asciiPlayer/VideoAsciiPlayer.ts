// VideoAsciiPlayer.ts
// 改進版：加入播放控制、資源管理、錯誤處理

export interface VideoAsciiPlayerOptions {
  chars?: string;
  step?: number;
  threshold?: number;
}

export class VideoAsciiPlayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private chars: string;
  private step: number;
  private threshold: number;
  private currentVideo: HTMLVideoElement | null = null;
  private data: string[][] = [];
  private animationFrameId: number | null = null;
  private onFrameCallback: ((frame: string[][]) => void) | null = null;

  constructor(options: VideoAsciiPlayerOptions = {}) {
    this.chars = options.chars ?? '@%#*+=-:. ';
    this.step = options.step ?? 2;
    this.threshold = options.threshold ?? Math.floor(255 * ((this.chars.length - 1) / this.chars.length));
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
  }

  /**
   * 載入影片（支援 base64 或 URL）
   */
  async loadVideo(src: string): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      
      // 根據 src 類型決定是否需要 crossOrigin
      if (!src.startsWith('data:') && !src.startsWith('blob:')) {
        video.crossOrigin = 'anonymous';
      }
      
      video.onloadedmetadata = () => {
        console.log('Video loaded:', video.videoWidth, 'x', video.videoHeight);
        resolve(video);
      };
      
      video.onerror = (err) => {
        console.error('Video error:', err);
        reject(new Error('影片載入失敗，請確認格式是否支援 (建議: MP4, WebM)'));
      };
      
      // 設定 src 要在事件監聽器之後
      video.src = src;
      video.load();
    });
  }

  /**
   * 設定目前要處理的影片
   */
  setVideo(video: HTMLVideoElement) {
    this.currentVideo = video;
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
  }

  /**
   * 播放影片並開始 ASCII 渲染
   */
  play(onFrame?: (frame: string[][]) => void) {
    if (!this.currentVideo) {
      throw new Error('No video loaded. Call setVideo() first.');
    }
    
    this.onFrameCallback = onFrame || null;
    this.currentVideo.play();
    this.startRendering();
  }

  /**
   * 暫停播放
   */
  pause() {
    this.currentVideo?.pause();
    this.stopRendering();
  }

  /**
   * 停止並重置
   */
  stop() {
    if (this.currentVideo) {
      this.currentVideo.pause();
      this.currentVideo.currentTime = 0;
    }
    this.stopRendering();
  }

  /**
   * 開始渲染循環
   */
  private startRendering() {
    const render = () => {
      if (this.currentVideo && !this.currentVideo.paused) {
        this.updateAsciiData();
        if (this.onFrameCallback) {
          this.onFrameCallback(this.data);
        }
        this.animationFrameId = requestAnimationFrame(render);
      }
    };
    render();
  }

  /**
   * 停止渲染循環
   */
  private stopRendering() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 取得目前 ASCII 幀資料
   */
  getAsciiFrame(): string[][] {
    if (!this.currentVideo) {
      throw new Error('No video loaded. Call setVideo() first.');
    }
    this.updateAsciiData();
    return this.data;
  }

  /**
   * 將目前影片幀轉成 ASCII 字元陣列
   */
  private updateAsciiData() {
    const video = this.currentVideo;
    if (!video) return;
    const { videoWidth: w, videoHeight: h } = video;
    this.ctx.drawImage(video, 0, 0, w, h);
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
              sum += img[idx]; // 只取紅色通道
            }
          }
        }
        const avg = sum / (this.step * this.step);
        const avg2 = avg > this.threshold ? 255 : avg;
        const idx = Math.floor((avg2 / 255) * (this.chars.length - 1));
        row.push(this.chars[idx]);
      }
      arr.push(row);
    }
    this.data = arr;
  }

  /**
   * 取得 canvas 實體（可用於 debug 或自訂渲染）
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * 取得目前影片
   */
  getVideo(): HTMLVideoElement | null {
    return this.currentVideo;
  }

  /**
   * 是否正在播放
   */
  isPlaying(): boolean {
    return this.currentVideo ? !this.currentVideo.paused : false;
  }

  /**
   * 清理資源
   */
  destroy() {
    this.stop();
    this.currentVideo = null;
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.data = [];
    this.onFrameCallback = null;
  }
}

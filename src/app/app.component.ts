import { Component, ElementRef, QueryList, ViewChildren, AfterViewInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';

interface Voice { frequency: number; volume: number; enabled: boolean; }
interface Noise { enabled: boolean; type: number; volume: number; }
interface Step { duration: number; voices: Voice[]; noise: Noise; }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  lang: 'de' | 'en' = 'de';
  currentView: 'introChips' | 'introWaves' | 'modeler' = 'introChips';
  attentionMode: boolean = false;
  
  maxSteps = 5;
  qrCodeDataUrl: string = '';

  steps: Step[] = [this.createStep()];

  @ViewChildren('waveCanvas') canvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  private idleTimeout: any;
  private attentionInterval: any;

  // i18n dictionary
  private dict: Record<string, Record<'de' | 'en', string>> = {
    title: { de: 'OCM Sound Generator', en: 'OCM Sound Generator' },
    btn_next: { de: 'WEITER', en: 'NEXT' },
    btn_start: { de: 'Eigene Sounds erstellen', en: 'Create your own sounds' },
    btn_play: { de: 'ALLE ABSPIELEN', en: 'PLAY ALL' },
    btn_add: { de: 'SCHRITT HINZUFÜGEN', en: 'ADD STEP' },
    btn_gen: { de: 'Code Generieren', en: 'Generate Code' },
    attention_msg: { de: 'Lass uns Sounds machen!', en: "Let's make sounds!" },
    scan_msg: { de: 'SCAN TO EXPORT', en: 'SCAN TO EXPORT' },
    step: { de: 'SCHRITT', en: 'STEP' },
    duration: { de: 'DAUER (ms)', en: 'DURATION (ms)' },
    channels: { de: 'KANÄLE', en: 'CHANNELS' },
    freq: { de: 'FREQ:', en: 'FREQ:' },
    vol: { de: 'VOL (0=MAX, 30=MIN):', en: 'VOL (0=MAX, 30=MIN):' },
    noise: { de: 'RAUSCHEN', en: 'NOISE' },
    active: { de: 'AKTIV', en: 'ACTIVE' },
    type: { de: 'TYP:', en: 'TYPE:' },
    waveform: { de: 'WELLENFORM', en: 'WAVEFORM' },
    info_chips_title: { de: 'SOUNDCHIPS', en: 'SOUND CHIPS' },
    info_chips_text: { 
      de: 'Der Commodore 64 nutzte den revolutionären SID-Chip für komplexe Klänge, während der TI-99/4A den TMS9919 mit 3 Rechteck-Kanälen und einem Rausch-Kanal verwendete. Diese Chips prägten den Sound einer ganzen Generation.',
      en: 'The Commodore 64 used the revolutionary SID chip for complex sounds, while the TI-99/4A utilized the TMS9919 with 3 square wave channels and one noise channel. These chips defined the sound of an entire generation.'
    },
    info_waves_title: { de: 'WELLENARTEN', en: 'WAVE TYPES' },
    info_waves_text: { 
      de: 'Frühe Computer konnten keine echten Audioaufnahmen abspielen. Stattdessen generierten sie einfache Wellenformen wie die Rechteckwelle ("Piepen") oder Rauschen ("Zischen", z. B. für Explosionen oder Drums) in Echtzeit.',
      en: 'Early computers could not play real audio recordings. Instead, they generated simple waveforms like square waves ("beeping") or noise ("hissing", used for explosions or drums) in real-time.'
    }
  };

  t(key: string): string {
    return this.dict[key] ? this.dict[key][this.lang] : key;
  }

  toggleLang() {
    this.lang = this.lang === 'de' ? 'en' : 'de';
  }

  constructor() {
    this.resetIdleTimer();
  }

  @HostListener('window:mousemove')
  @HostListener('window:keydown')
  @HostListener('window:click')
  @HostListener('window:touchstart')
  resetIdleTimer() {
    if (this.attentionMode) {
      this.attentionMode = false;
      clearInterval(this.attentionInterval);
      if (this.currentView === 'modeler') {
         setTimeout(() => this.drawAllWaves(), 0);
      }
    }
    
    clearTimeout(this.idleTimeout);
    this.idleTimeout = setTimeout(() => {
      this.triggerAttentionMode();
    }, 30000); // 30 seconds
  }

  triggerAttentionMode() {
    this.attentionMode = true;
    this.playAttentionSound();
    
    this.attentionInterval = setInterval(() => {
      this.playAttentionSound();
    }, 30000);
  }

  playAttentionSound() {
    // A classic retro 8-bit jingle
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContext();
    
    const jingle = [
      { freq: 392.00, dur: 0.1 }, // G4
      { freq: 523.25, dur: 0.1 }, // C5
      { freq: 659.25, dur: 0.1 }, // E5
      { freq: 783.99, dur: 0.2 }, // G5
      { freq: 1046.50, dur: 0.4 } // C6
    ];
    
    let time = audioCtx.currentTime;
    
    jingle.forEach(note => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = note.freq;
      
      // Add a slight volume envelope for the jingle to sound better
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + note.dur - 0.02);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(time);
      osc.stop(time + note.dur);
      time += note.dur;
    });
  }

  ngOnDestroy() {
    clearTimeout(this.idleTimeout);
    clearInterval(this.attentionInterval);
  }

  ngAfterViewInit() {
    if (this.currentView === 'modeler') {
      this.drawAllWaves();
    }
    this.canvases.changes.subscribe(() => {
      if (this.currentView === 'modeler') {
        this.drawAllWaves();
      }
    });
  }

  nextView(view: 'introWaves' | 'modeler') {
    this.currentView = view;
  }

  createStep(): Step {
    return {
      duration: 500,
      voices: [
        { frequency: 440, volume: 15, enabled: true },
        { frequency: 550, volume: 22, enabled: false },
        { frequency: 660, volume: 22, enabled: false }
      ],
      noise: { enabled: false, type: -4, volume: 8 }
    };
  }

  addStep() {
    if (this.steps.length >= this.maxSteps) {
      alert('Max steps reached.');
      return;
    }
    this.steps.push(this.createStep());
    setTimeout(() => this.drawAllWaves(), 0);
  }

  removeStep(index: number) {
    this.steps.splice(index, 1);
    setTimeout(() => this.drawAllWaves(), 0);
  }

  onStepChange() {
    this.drawAllWaves();
    this.qrCodeDataUrl = ''; 
  }

  drawAllWaves() {
    this.canvases.forEach((canvasRef, index) => {
      this.drawWave(canvasRef.nativeElement, this.steps[index]);
    });
  }

  drawWave(canvas: HTMLCanvasElement, step: Step) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = '#002200';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00ff00';
    ctx.beginPath();

    const activeVoices = step.voices.filter(v => v.enabled);
    if (activeVoices.length === 0 && !step.noise.enabled) {
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    for (let x = 0; x < width; x++) {
      let yTotal = 0;
      let voiceCount = 0;
      const t = x / width;

      activeVoices.forEach(voice => {
        const period = 1000 / voice.frequency; 
        const phase = (t * step.duration) % period;
        const val = phase < period / 2 ? 1 : -1;
        yTotal += val * (1 - (voice.volume / 30));
        voiceCount++;
      });

      if (step.noise.enabled) {
        yTotal += (Math.random() * 2 - 1) * (1 - (step.noise.volume / 30));
        voiceCount++;
      }

      const normalizedY = voiceCount > 0 ? yTotal / voiceCount : 0;
      const py = height / 2 - (normalizedY * (height / 2 - 5));

      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }

    ctx.stroke();
  }

  async playTones() {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContext();

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    let startTime = audioCtx.currentTime;

    this.steps.forEach(step => {
      const durationSec = step.duration / 1000;

      step.voices.forEach(voice => {
        if (!voice.enabled) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = voice.frequency;
        gain.gain.value = Math.max(0.01, 1 - (voice.volume / 30));
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + durationSec);
      });

      if (step.noise.enabled) {
        this.playNoise(audioCtx, startTime, durationSec, step.noise.volume);
      }

      startTime += durationSec;
    });
  }

  playNoise(audioCtx: AudioContext, startTime: number, durationSec: number, volume: number) {
    const bufferSize = audioCtx.sampleRate * durationSec;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    gain.gain.value = Math.max(0.01, 1 - (volume / 30));
    noise.buffer = buffer;
    noise.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(startTime);
    noise.stop(startTime + durationSec);
  }

  async generateQRCode() {
    try {
      // Short custom encoder: duration;f1,v1;f2,v2;f3,v3;n_en,n_type,n_vol|next...
      const encodedStrings = this.steps.map(step => {
        const d = step.duration;
        const v1 = step.voices[0].enabled ? `${step.voices[0].frequency},${step.voices[0].volume}` : '0,0';
        const v2 = step.voices[1].enabled ? `${step.voices[1].frequency},${step.voices[1].volume}` : '0,0';
        const v3 = step.voices[2].enabled ? `${step.voices[2].frequency},${step.voices[2].volume}` : '0,0';
        const n = `${step.noise.enabled ? 1 : 0},${step.noise.type},${step.noise.volume}`;
        return `${d}-${v1}-${v2}-${v3}-${n}`;
      });
      
      const shortData = encodedStrings.join('_');
      const targetUrl = `https://hamschter-hsb.github.io/xr-museum-client/?data=${shortData}`;
      
      // Log exactly what is generated, but don't show on UI
      console.log('--- GENERATED URL ---');
      console.log(targetUrl);
      console.log('---------------------');
      
      this.qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (err) {
      console.error(err);
      alert('Failed to generate QR Code');
    }
  }
}

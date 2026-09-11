import * as THREE from 'three';
import { Renderer } from './core/Renderer';
import { SceneManager } from './core/SceneManager';
import { PerformanceManager } from './core/PerformanceManager';
import { AssetManager } from './core/AssetManager';
import { CameraDirector } from './camera/CameraDirector';
import { TimelineManager } from './timeline/TimelineManager';
import { CityGenerator } from './city/CityGenerator';
import { TrafficSystem } from './systems/TrafficSystem';
import { WeatherSystem } from './systems/WeatherSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { FractureSystem } from './systems/FractureSystem';
import { GravitySystem } from './systems/GravitySystem';
import { PortalSystem } from './systems/PortalSystem';
import { CollapseSystem } from './systems/CollapseSystem';
import { AudioManager } from './audio/AudioManager';
import { PostProcessingManager } from './post/PostProcessingManager';
import { LoadingScreen } from './ui/LoadingScreen';
import { HUD } from './ui/HUD';
import { DebugTools } from './debug/DebugTools';
import type { PhaseDef } from './timeline/states';
import type { QualitySettings } from './utils/quality';

export class App {
  private renderer!: Renderer;
  private scenes!: SceneManager;
  private perf!: PerformanceManager;
  private assets!: AssetManager;
  private camera!: CameraDirector;
  private timeline!: TimelineManager;
  private city!: CityGenerator;
  private traffic!: TrafficSystem;
  private weather!: WeatherSystem;
  private particles!: ParticleSystem;
  private fracture!: FractureSystem;
  private gravity!: GravitySystem;
  private portals!: PortalSystem;
  private collapse!: CollapseSystem;
  private audio!: AudioManager;
  private post!: PostProcessingManager;
  private loader!: LoadingScreen;
  private hud!: HUD;
  private debug!: DebugTools;

  private clock = new THREE.Clock();
  private running = false;
  private cityFade = 1;

  async start(): Promise<void> {
    const canvas = document.getElementById('webgl') as HTMLCanvasElement;
    const proxy = document.getElementById('scroll-proxy') as HTMLElement;

    this.loader = new LoadingScreen();
    this.hud = new HUD();
    this.assets = new AssetManager();
    this.perf = new PerformanceManager();
    this.audio = new AudioManager();

    this.assets.onProgress((p) => this.loader.setProgress(p));

    await this.assets.bootSequence([
      async () => {
        this.renderer = new Renderer(canvas);
        this.scenes = new SceneManager();
        this.camera = new CameraDirector();
        this.timeline = new TimelineManager(proxy);
      },
      async () => {
        const q = this.perf.settings;
        this.city = new CityGenerator(q.buildingCount);
        this.scenes.cityRoot.add(this.city.group);
      },
      async () => {
        const q = this.perf.settings;
        this.traffic = new TrafficSystem(q.trafficCount);
        this.weather = new WeatherSystem(q.rainCount);
        this.particles = new ParticleSystem(900);
        this.scenes.fxRoot.add(this.traffic.group);
        this.scenes.fxRoot.add(this.weather.group);
        this.scenes.fxRoot.add(this.particles.group);
      },
      async () => {
        this.fracture = new FractureSystem();
        this.gravity = new GravitySystem();
        this.portals = new PortalSystem();
        this.collapse = new CollapseSystem();
        this.scenes.fxRoot.add(this.fracture.group);
        this.scenes.fxRoot.add(this.gravity.group);
        this.scenes.fxRoot.add(this.portals.group);
        this.scenes.finaleRoot.add(this.collapse.group);
      },
      async () => {
        this.post = new PostProcessingManager(
          this.renderer.renderer,
          this.scenes.scene,
          this.camera.camera
        );
        this.applyQuality(this.perf.settings);
      },
      async () => {
        this.bindUI();
        this.debug = new DebugTools(this.timeline, this.perf);
        this.timeline.onUpdate((p, phase) => this.onTimeline(p, phase));
      },
    ]);

    await this.loader.hide();
    this.hud.show();
    this.hud.setQuality(this.perf.level);
    this.hud.setPhase(this.timeline.getPhase());

    window.addEventListener('resize', () => this.onResize());
    this.onResize();
    this.running = true;
    this.loop();
  }

  private bindUI(): void {
    this.hud.onAudio(() => {
      const on = this.audio.toggle();
      this.hud.setAudio(on);
    });
    this.hud.onQuality(() => {
      const next = this.perf.cycle();
      this.hud.setQuality(next);
      this.applyQuality(this.perf.settings);
    });
    this.perf.onChange((level, settings) => {
      this.hud.setQuality(level);
      this.applyQuality(settings);
    });

    const unlock = () => {
      void this.audio.resume().then(() => this.hud.setAudio(true));
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
  }

  private applyQuality(q: QualitySettings): void {
    this.renderer.applyQuality(q);
    this.post.applyQuality(q);
    this.weather.setIntensity(q.rainCount > 1000 ? 1 : 0.5);
  }

  private onTimeline(_p: number, phase: PhaseDef): void {
    this.hud.setPhase(phase);
  }

  private onResize(): void {
    this.renderer.resize();
    this.camera.resize();
    const { width, height } = this.renderer.getSize();
    this.post.setSize(width, height);
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    this.perf.update(dt);
    this.timeline.update(dt);

    const progress = this.timeline.progress;
    const knobs = this.timeline.getKnobs();

    this.camera.update(progress, knobs);

    // Atmosphere evolution — cold night → fracture magenta → void → finale
    const fogDensity =
      0.00125 + knobs.fracture * 0.0007 + knobs.ghost * 0.0004 - knobs.finale * 0.0011;
    let fogColor = 0x060a14;
    if (knobs.finale > 0.35) fogColor = 0x010208;
    else if (knobs.silence > 0.3) fogColor = 0x04060c;
    else if (knobs.core > 0.4) fogColor = 0x100814;
    else if (knobs.fracture > 0.3) fogColor = 0x0a0814;
    this.scenes.setFog(Math.max(0.00015, fogDensity), fogColor);

    const rim = this.scenes.getFractureLight();
    rim.intensity = knobs.fracture * 2.8 + knobs.core * 5.5;
    rim.position.copy(this.fracture.corePos);

    this.cityFade = 1 - knobs.finale * 0.95 - knobs.dissolve * 0.45;
    this.city.setVisible(this.cityFade > 0.05);
    this.scenes.cityRoot.visible = this.cityFade > 0.05;
    this.scenes.finaleRoot.visible = knobs.finale > 0.05 || knobs.silence > 0.5;

    // Hard gate: no vertex chaos until the flythrough earns trust
    const cityKnobs = {
      fracture: progress < 0.35 ? 0 : knobs.fracture,
      gravity: progress < 0.35 ? 0 : knobs.gravity,
      fold: progress < 0.35 ? 0 : knobs.fold,
      dissolve: knobs.dissolve,
      ghost: progress < 0.35 ? 0 : knobs.ghost,
    };
    this.city.update(time, this.camera.camera.position, cityKnobs);

    this.traffic.setGlitch(knobs.trafficGlitch);
    this.traffic.update(dt);

    this.weather.setIntensity(knobs.rain * (this.perf.settings.rainCount > 500 ? 1 : 0.4));
    this.weather.update(dt, this.camera.camera.position);

    this.particles.setStrength(Math.max(knobs.fracture, knobs.core));
    this.particles.update(dt, this.fracture.corePos);

    this.fracture.setIntensity(Math.max(knobs.fracture * 0.45, knobs.core));
    this.fracture.update(time);

    this.gravity.setStrength(knobs.gravity);
    this.gravity.update(time);

    this.portals.setStrength(Math.max(knobs.ghost, knobs.fold * 0.55));
    this.portals.update(time);

    this.collapse.setStrength(knobs.finale);
    this.collapse.update(time);

    this.post.update(knobs);
    this.audio.update(knobs);
    this.hud.updateProgress(progress, knobs.finale);
    this.debug.update(progress);

    this.post.render(dt);
  };
}

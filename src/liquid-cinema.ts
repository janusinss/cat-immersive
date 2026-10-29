import { getLiquidState } from './liquid-state';

const vertexSource = `attribute vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;
const fragmentSource = `precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform float energy;
float water(vec2 p){
  float a=sin(p.x*3.8+p.y*2.4-time*.42);
  float b=sin(p.x*6.2-p.y*4.3+time*.31+a*.7);
  float c=sin(length(p-vec2(.3,-.15))*11.-time*1.5);
  return a*.32+b*.16+c*.09*energy;
}
void main(){
  vec2 uv=gl_FragCoord.xy/resolution;
  vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.)*3.;
  float h=water(p);
  vec2 slope=vec2(water(p+vec2(.025,0.))-h,water(p+vec2(0.,.025))-h)/.025;
  vec3 normal=normalize(vec3(-slope*.55,1.));
  float light=max(0.,dot(normal,normalize(vec3(-.5,.8,1.))));
  float silk=pow(light,12.)*(.22+energy*.26);
  float ribbon=pow(max(0.,1.-abs(sin(p.y*3.1+p.x*.8+h*2.-time*.18))),14.);
  float edge=smoothstep(.12,.6,abs(uv.x-.5))+smoothstep(.14,.5,abs(uv.y-.5))*.5;
  vec3 dark=vec3(.027,.037,.052);
  vec3 silver=vec3(.43,.51,.60);
  vec3 color=dark+silver*(silk+ribbon*(.045+energy*.1))*min(1.,edge+.24);
  color*=.72+.28*smoothstep(0.,.5,min(uv.x,1.-uv.x)+.1);
  gl_FragColor=vec4(color,1.);
}`;

type LiquidRenderer = { render: (time: number, duration: number) => void; destroy: () => void };
export function createLiquidCinema(host: HTMLElement, mobile: boolean): LiquidRenderer {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  let destroyed = false;
  let lost = false;
  let lastTime = -1;
  let lastWall = 0;
  let sampleCount = 0;
  let sampleTotal = 0;
  let lighter: LiquidRenderer | null = null;
  const cleanups: (() => void)[] = [];
  let draw: (time: number, energy: number) => void;
  let resize: () => void;
  const fallback = (reason: string) => {
    host.dataset.liquid = 'fallback';
    canvas.style.visibility = 'hidden';
    if (reason) console.warn(`[Liquid cinema] ${reason}; using the film atmosphere.`);
  };

  if (mobile) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) { fallback('Canvas unavailable'); return { render() {}, destroy() { canvas.remove(); } }; }
    host.dataset.liquid = 'canvas';
    resize = () => { canvas.width = Math.min(540, host.clientWidth); canvas.height = Math.round(canvas.width * host.clientHeight / Math.max(1, host.clientWidth)); };
    draw = (time, energy) => {
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = '#0b1017'; ctx.fillRect(0, 0, w, h);
      for (let band = 0; band < 14; band++) {
        ctx.beginPath();
        for (let step = 0; step <= 30; step++) {
          const x = step / 30 * w;
          const wave = Math.sin(x / w * 5 + time * .32 + band * .45) * h * .035;
          const ripple = Math.sin(x / w * 11 - time * .7 + band * .3) * h * .008 * energy;
          const y = h * (band / 13 * 1.1 - .05) + wave + ripple;
          if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(170,194,218,${.045 + energy * .065})`;
        ctx.lineWidth = band % 3 === 0 ? 2 : .65;
        ctx.stroke();
      }
    };
  } else {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) { fallback('WebGL unavailable'); return { render() {}, destroy() { canvas.remove(); } }; }
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Shader allocation failed');
      cleanups.push(() => gl.deleteShader(shader));
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
      return shader;
    };
    try {
      const program = gl.createProgram();
      if (program) cleanups.push(() => gl.deleteProgram(program));
      const buffer = gl.createBuffer();
      if (buffer) cleanups.push(() => gl.deleteBuffer(buffer));
      if (!program || !buffer) throw new Error('GPU allocation failed');
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Shader linking failed');
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const resolution = gl.getUniformLocation(program, 'resolution');
      const timeUniform = gl.getUniformLocation(program, 'time');
      const energyUniform = gl.getUniformLocation(program, 'energy');
      resize = () => {
        const scale = Math.min(1, 640 / Math.max(1, host.clientWidth));
        canvas.width = Math.round(host.clientWidth * scale); canvas.height = Math.round(host.clientHeight * scale);
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      draw = (time, energy) => {
        gl.uniform2f(resolution, canvas.width, canvas.height); gl.uniform1f(timeUniform, time); gl.uniform1f(energyUniform, energy);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      host.dataset.liquid = 'webgl';
      const contextLost = (event: Event) => { event.preventDefault(); lost = true; fallback('GPU context lost'); };
      canvas.addEventListener('webglcontextlost', contextLost);
      cleanups.push(() => canvas.removeEventListener('webglcontextlost', contextLost));
    } catch (error) {
      cleanups.splice(0).forEach(cleanup => cleanup());
      fallback(error instanceof Error ? error.message : 'GPU initialization failed');
      return { render() {}, destroy() { canvas.remove(); } };
    }
  }
  const render = (time: number, duration: number) => {
    if (destroyed || lost || document.hidden) return;
    if (lighter) { lighter.render(time, duration); return; }
    if (mobile && host.dataset.quality === 'adaptive') {
      // Slow GPUs keep a pre-rendered water surface moving on the compositor.
      canvas.style.transform = `translate3d(${Math.sin(time * .24) * 7}px,${Math.cos(time * .18) * 5}px,0) scale(1.06)`;
      return;
    }
    const now = performance.now();
    const elapsed = now - lastWall;
    lastWall = now;
    if (!mobile && elapsed > 0 && elapsed < 150 && lastTime >= 0 && time !== lastTime) {
      sampleCount++; sampleTotal += elapsed;
      if (sampleCount >= 24 && sampleTotal / sampleCount > 25) {
        cleanups.splice(0).forEach(cleanup => cleanup());
        canvas.remove();
        lighter = createLiquidCinema(host, true);
        host.dataset.quality = 'adaptive';
        lighter.render(time, duration);
        return;
      }
    }
    if (lastTime >= 0 && Math.abs(time - lastTime) < (mobile ? 1 / 30 : 1 / 45)) return;
    lastTime = time;
    const state = getLiquidState(time, duration);
    draw(state.time, state.energy);
  };
  const onResize = () => {
    if (!lighter) {
      resize();
      if (mobile && host.dataset.quality === 'adaptive') draw(Math.max(0, lastTime), .18);
      lastTime = -1;
    }
  };
  window.addEventListener('resize', onResize);
  resize(); render(0, 30.2);
  return {
    render,
    destroy() {
      destroyed = true;
      window.removeEventListener('resize', onResize);
      cleanups.splice(0).forEach(cleanup => cleanup());
      lighter?.destroy();
      canvas.remove(); delete host.dataset.liquid;
      delete host.dataset.quality;
    },
  };
}

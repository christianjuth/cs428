function clamp(min, val, max) {
  return Math.max(Math.min(max, val), min)
}


class Clock {
  delta() {
    const now = window.performance.now()
    const delta = now - (this.prevTime || now)
    this.prevTime = now
    return delta/20
  }
}

class Scene {
  gl = null
  canvas = null
  shaderProgram = null
  vertices = []
  colors = []
  resetShaders = () => { }
  onResize = () => { }
  objects = []

  // Array of functions that get run when we .destroy() the maze
  teardownFns = []

  edgeShaders() {
    return {
      [this.gl.VERTEX_SHADER]: `
        attribute vec3 coordinates;
        attribute vec3 color;

        varying lowp vec4 vColor;
        
        void main(void)
        {
          float zToDivideBy = 1.0 + coordinates.z * 0.5;
          gl_Position = vec4(coordinates, zToDivideBy);
          vColor = vec4(color, 1.0); 
        }
      `,
      [this.gl.FRAGMENT_SHADER]: `
        varying lowp vec4 vColor;

        void main(void)
        {
          gl_FragColor = vColor;
        }
      `
    }
  }

  constructor(canvas) {
    this.canvas = canvas
    this.gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    this.shaderProgram = this.gl.createProgram();
    this.calculateCanvasSize()

    let id = null

    // To prevent issues with anti-aliasing
    // we need to recalculate canvas size whenever
    // the canvas offsetHeight/offsetWidth changes.
    const resizeObserver = new ResizeObserver(() => {
      // Debounce so it doesn't fire multiple times while resizing
      window.clearTimeout(id)
      id = window.setTimeout(() => {
        this.calculateCanvasSize()
        this.onResize()
      }, 100)
    });
    resizeObserver.observe(canvas);

    this.teardownFns.push(() => resizeObserver.unobserve(canvas))
  }

  // I ran into a bunch of issues with anti-aliasing.
  // I got the best results when I turned off anti-aliasing,
  // and resized the canvas to match its render size (offsetHeight/offsetWidth).
  calculateCanvasSize() {
    const { canvas, gl } = this
    canvas.height = canvas.offsetHeight
    canvas.width = canvas.offsetWidth
    gl.viewport(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  }

  loadShaders(shaders) {
    this.resetShaders()

    const { gl, shaderProgram } = this
    const resetFns = []

    for (const [shaderType, shaderCode] of Object.entries(shaders)) {
      const vertShader = gl.createShader(shaderType);
      gl.shaderSource(vertShader, shaderCode);
      gl.compileShader(vertShader);
      gl.attachShader(shaderProgram, vertShader);
      resetFns.push(() => {
        gl.detachShader(shaderProgram, vertShader);
      })
    }

    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    this.resetShaders = () => {
      for (const fn of resetFns) {
        fn()
      }
    }
  }

  addLine(v3_1, v3_2, color = new RGBColor(255,255,255)) {
    this.vertices.push(
      v3_1.x, v3_1.y, v3_1.z,
      v3_2.x, v3_2.y, v3_2.z,
    )
    this.colors.push(...color.toShaderDataArray(), ...color.toShaderDataArray())
  }

  add(object) {
    this.objects.push(object)
  }

  remove(object) {
    this.objects = this.objects.filter(obj => obj !== object)
  }

  render(delta) {
    for (const object of this.objects) {
      object.render(this, delta)
    }

    const { gl, shaderProgram, vertices, colors } = this

    // reset
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // end reset

    if (vertices.length > 0) {
      this.loadShaders(this.edgeShaders())

      const coord = gl.getAttribLocation(shaderProgram, "coordinates");
      const color = gl.getAttribLocation(shaderProgram, "color");

      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

      gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(coord);

      const colorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

      gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(color);

      gl.drawArrays(gl.LINES, 0, vertices.length / 3);
    }

    this.vertices = []
    this.colors = []
  }

  destroy() {
    for (const fn of this.teardownFns) {
      fn()
    }
  }
}


class Shader {
  teardownFns = []

  vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying lowp vec4 vColor;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vColor = aVertexColor;
    }
  `;

  fsSource = `
    varying lowp vec4 vColor;

    void main(void) {
      gl_FragColor = vColor;
    }
  `;

  constructor(canvas) {
    this.canvas = canvas
    this.gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    this.shaderProgram = this.gl.createProgram();
    this.calculateCanvasSize()

    let id = null

    // To prevent issues with anti-aliasing
    // we need to recalculate canvas size whenever
    // the canvas offsetHeight/offsetWidth changes.
    const resizeObserver = new ResizeObserver(() => {
      // Debounce so it doesn't fire multiple times while resizing
      window.clearTimeout(id)
      id = window.setTimeout(() => {
        this.calculateCanvasSize()
      }, 100)
    });
    resizeObserver.observe(canvas);

    this.teardownFns.push(() => resizeObserver.unobserve(canvas))
  }

  calculateCanvasSize() {
    const { canvas, gl } = this
    canvas.height = canvas.offsetHeight
    canvas.width = canvas.offsetWidth
    gl.viewport(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  }

  setupShaders() {
    const { gl, vsSource, fsSource } = this

    const shaderProgram = this.shaderProgram

    const vertShaderType = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vertShaderType, vsSource);
    gl.compileShader(vertShaderType);
    gl.attachShader(shaderProgram, vertShaderType);

    const fragShaderType = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fragShaderType, fsSource);
    gl.compileShader(fragShaderType);
    gl.attachShader(shaderProgram, fragShaderType);

    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram); 
  }

  render() {
    const { gl, shaderProgram } = this

    // reset
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // end reset

    this.setupShaders()

    const aVertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition')
    const aVertexColor = gl.getAttribLocation(shaderProgram, 'aVertexColor')
    
    const colors = [
      1.0,  1.0,  1.0,  1.0,    // white
      1.0,  0.0,  0.0,  1.0,    // red
      0.0,  1.0,  0.0,  1.0,    // green
      0.0,  0.0,  1.0,  1.0,    // blue
    ];
  
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    const numComponents = 4;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(
      aVertexColor,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
      aVertexColor);

    {
      const offset = 0;
      const vertexCount = 4;
      gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }
  }
}

// COLORS

// HTML ELEMENTS
const canvas = document.getElementsByTagName('canvas')[0]

// SCENE
const scene = new Shader(canvas)
const clock = new Clock()

// OBJECTS

// START RENDER LOOP
scene.render()
// let prevTime = window.performance.now()
// function start() {


//   scene.render(clock.delta())
//   window.requestAnimationFrame(start)
// }
// start()
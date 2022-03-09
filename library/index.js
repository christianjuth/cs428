function clamp(min, val, max) {
  return Math.max(Math.min(max, val), min)
}

function lerp(v0, v1, t) {
  return v0 + t * (v1 - v0);
}

function invlerp(v0, v1, v) {
  return (v - v0) / (v1 - v0)
}

class RGBColor {
  constructor(r, g, b) {
    this.r = r
    this.g = g
    this.b = b
  }

  toShaderDataArray() {
    return [this.r / 255, this.g / 255, this.b / 255]
  }

  /**
   * Converts an RGB color value to HSL. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes r, g, and b are contained in the set [0, 255] and
   * returns h, s, and l in the set [0, 360], [0, 100] and [1, 100].
   *
   * @param   {number}  r       The red color value
   * @param   {number}  g       The green color value
   * @param   {number}  b       The blue color value
   * @return  {Array}           The HSL representation
   */
  toHsl() {
    let { r, g, b } = this
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max == min) {
      h = s = 0; // achromatic
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    h *= 360
    s *= 100
    l *= 100

    return [h, s, l];
  }

  hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;

    if (s == 0) {
      r = g = b = l; // achromatic
    } else {
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      }

      let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      let p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
  }

  shiftHue(hShift) {
    let [h, s, l] = this.toHsl()
    h += hShift
    h = h % 360
    const [r, g, b] = this.hslToRgb(h, s, l)
    this.r = r
    this.g = g
    this.b = b
  }
}

class Clock {
  delta() {
    const now = window.performance.now()
    const delta = now - (this.prevTime || now)
    this.prevTime = now
    return delta / 20
  }
}

class Vector3 {
  constructor(x, y, z = 0) {
    this.x = x
    this.y = y
    this.z = z
  }

  rotate(vec3) {
    const pitch = vec3.x
    const roll = vec3.y
    const yaw = vec3.z

    var cosa = Math.cos(yaw);
    var sina = Math.sin(yaw);

    var cosb = Math.cos(pitch);
    var sinb = Math.sin(pitch);

    var cosc = Math.cos(roll);
    var sinc = Math.sin(roll);

    var Axx = cosa * cosb;
    var Axy = cosa * sinb * sinc - sina * cosc;
    var Axz = cosa * sinb * cosc + sina * sinc;

    var Ayx = sina * cosb;
    var Ayy = sina * sinb * sinc + cosa * cosc;
    var Ayz = sina * sinb * cosc - cosa * sinc;

    var Azx = -sinb;
    var Azy = cosb * sinc;
    var Azz = cosb * cosc;

    var px = this.x;
    var py = this.y;
    var pz = this.z;

    this.x = Axx * px + Axy * py + Axz * pz;
    this.y = Ayx * px + Ayy * py + Ayz * pz;
    this.z = Azx * px + Azy * py + Azz * pz;

    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z)
  }

  add(vec3) {
    this.x += vec3.x
    this.y += vec3.y
    this.z += vec3.z
    return this
  }

  subtract(vec3) {
    this.x -= vec3.x
    this.y -= vec3.y
    this.z -= vec3.z
    return this
  }

  scale(mul) {
    if (mul.constructor === Vector3) {
      this.x *= mul.x
      this.y *= mul.y
      this.z *= mul.z
    } else if (typeof mul === 'number') {
      this.x *= mul
      this.y *= mul
      this.z *= mul
    }
    return this
  }

  // Use this when sufficent since its faster than computing
  // the length (multiplication is much fater than sqrt).
  lengthSquared() {
    return this.x ** 2 + this.y ** 2 + this.z ** 2
  }

  length() {
    return Math.sqrt(this.lengthSquared())
  }

  normailze() {
    const length = this.length()
    this.x /= length
    this.y /= length
    this.z /= length
    return this
  }

  dotProduct(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z
  }
}

class Shaders {
  programs = {}

  constructor(gl) {
    this.gl = gl

    const vertShaderCode = `
      attribute vec3 coordinates;
      uniform float brightness;
      uniform vec3 color;

      varying lowp float vBrightness;
      varying lowp vec4 vColor;

      void main(void)
      {
        float zToDivideBy = 1.0 + coordinates.z * 0.5;
        gl_Position = vec4(coordinates, zToDivideBy);
        vBrightness = brightness;
        vColor = vec4(color, 1.0);
      }
    `

    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertShaderCode);
    gl.compileShader(vertShader);
    this.vertShader = vertShader;
  }

  load(fragmentShaderCode) {
    const { gl, programs } = this
    if (programs[fragmentShaderCode]) {
      gl.useProgram(programs[fragmentShaderCode])
      return programs[fragmentShaderCode]
    }

    const program = gl.createProgram()

    // everything uses the same vertex shader
    gl.attachShader(program, this.vertShader)

    // load unique fragment shader
    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragmentShaderCode);
    gl.compileShader(fragShader)
    gl.attachShader(program, fragShader);

    gl.linkProgram(program);
    gl.useProgram(program);

    programs[fragmentShaderCode] = program
    return program
  }
}

class Scene {
  gl = null
  canvas = null
  shaderProgram = null
  vertices = []
  resetShaders = () => { }
  onResize = () => { }

  meshes = []
  triangles = [] // Used for gl.TRIANGLES
  lines = [] // Used for gl.LINES

  // Array of functions that get run when we .destroy() the maze
  teardownFns = []

  constructor(canvas) {
    this.canvas = canvas
    this.gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    this.calculateCanvasSize()

    this.shaders = new Shaders(this.gl)

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

  addPoint(v3) {
    this.vertices.push(v3.x, v3.y, v3.z)
  }

  add(mesh) {
    this.meshes.push(mesh)
  }

  remove(mesh) {
    this.mesh = this.mesh.filter(m => m !== mesh)
  }

  prepareDrawing(points) {
    const { gl, shaderProgram } = this

    const coord = gl.getAttribLocation(shaderProgram, "coordinates");
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
    gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(coord);
  }

  renderTriangles(points, brightness) {
    const { gl } = this
    this.prepareDrawing(points, brightness)
    gl.drawArrays(gl.TRIANGLES, 0, points.length / 3);
  }

  renderLines(points, brightness) {
    const { gl } = this
    this.prepareDrawing(points, brightness)
    gl.drawArrays(gl.LINES, 0, points.length / 3);
  }

  render(delta) {
    const { gl } = this

    // reset
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // end reset

    for (const mesh of this.meshes) {
      const surfaces = mesh.getSurfaces()

      this.shaderProgram = this.shaders.load(mesh.getFragmentShader())

      const brightnessLoc = gl.getUniformLocation(this.shaderProgram, "brightness");
      const colorLoc = gl.getUniformLocation(this.shaderProgram, "color");

      const color = mesh.getColor()
      gl.uniform3fv(colorLoc, color.toShaderDataArray())

      for (const { points, brightness } of surfaces) {
        const meshPoints = points.map(v3 => [v3.x, v3.y, v3.z]).flat()
        gl.uniform1f(brightnessLoc, brightness);

        switch (mesh.getDrawMode()) {
          case 'TRIANGLES':
            this.renderTriangles(meshPoints, brightness)
            break;
          case 'LINES':
            this.renderLines(meshPoints, brightness)
            break;
        }
      }
    }
  }

  destroy() {
    for (const fn of this.teardownFns) {
      fn()
    }
  }
}

class PolygonSurface {
  constructor(config) {
    this.config = {
      radius: 1,
      sides: 40,
      center: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      color: new RGBColor(255, 255, 255),
      normal: new Vector3(0, 0, -1),
      ...config,
    }
    // TODO: fix this so you can actually pass in points
    this.points = this.points || this.createEdgePoints()
  }

  createEdgePoints() {
    const { sides, radius, center } = this.config

    const edgePoint = new Vector3(0, 0, 0)
    edgePoint.x += radius
    const edgePoints = []

    // rotate spokes 360 degress to get shape spacing each evenly
    const radians = Math.PI * 2 / sides
    const rotationVector = new Vector3(0, 0, radians)

    // change the starting point of our 360 degree spoke rotation
    edgePoint.rotate(new Vector3(0, 0, 0))

    for (let i = 0; i <= sides; i++) {
      const newPoint = edgePoint.clone()
      edgePoints.push(newPoint)
      edgePoint.rotate(rotationVector)
    }

    return edgePoints
  }

  getEdgePoints() {
    const { center } = this.config
    return this.points.map(p => p.clone().add(center))
  }

  clone() {
    const configClone = {}
    for (const key in this.config) {
      const val = this.config[key]
      if (typeof val.clone === 'function') {
        configClone[key] = val.clone()
      } else {
        configClone[key] = val
      }
    }
    const clone = new Polygon(configClone)
    clone.points = this.points.map(p => p.clone())
    return clone
  }

  rotate(vec3) {
    for (const point of this.points) {
      point.rotate(vec3)
    }
    this.config.rotation.add(vec3)
    this.config.normal.rotate(vec3)
  }
}

class Polygon extends PolygonSurface {
  getSurfaces() {
    return [this]
  }
}

class CubeGeometry {
  constructor(config) {
    config = {
      center: new Vector3(0, 0, 0),
      ...config,
    }
    this.config = config
    // TODO: fix this so you can actually pass in surfaces
    this.surfaces = this.surfaces || this.createSurfaces()
  }

  createSurfaces() {
    const { config } = this
    const surfaces = []

    const halfSize = config.size / 2

    const square = new PolygonSurface({
      sides: 4,
      radius: Math.sqrt(2 * (halfSize ** 2)),
      center: new Vector3(0, 0, -config.size / 2)
    })

    square.rotate(new Vector3(0, 0, Math.PI / 4))
    const rotationVector = new Vector3(Math.PI / 2, Math.PI / 2, 0)

    for (let i = 0; i < 3; i++) {
      const newSurface = square.clone()
      surfaces.push(newSurface)
      square.config.center.rotate(rotationVector)
      square.rotate(rotationVector)
    }

    const flipRotation = new Vector3(0, Math.PI, 0)
    square.rotate(flipRotation)
    square.config.center.rotate(flipRotation)

    for (let i = 0; i < 3; i++) {
      const newSurface = square.clone()
      surfaces.push(newSurface)
      square.config.center.rotate(rotationVector)
      square.rotate(rotationVector)
    }

    return surfaces
  }

  getSurfaces() {
    const { center } = this.config
    this.surfaces
      .sort((a, b) => b.config.center.z - a.config.center.z)

    return this.surfaces.map(surface => {
      const clone = surface.clone()
      clone.config.center.add(center)
      return clone
    })
  }

  rotate(vec3) {
    for (const surface of this.surfaces) {
      surface.rotate(vec3)
      surface.config.center.rotate(vec3)
    }
  }

  clone() {
    const configClone = {}
    for (const key in this.config) {
      const val = this.config[key]
      if (typeof val.clone === 'function') {
        configClone[key] = val.clone()
      } else {
        configClone[key] = val
      }
    }
    const clone = new CubeGeometry(configClone)
    clone.surfaces = this.surfaces.map(s => s.clone())
    return clone
  }
}

class SolidMaterial {
  drawMode = 'TRIANGLES'

  constructor(config = {}) {
    this.config = {
      color: new RGBColor(255, 0, 0),
      ...config,
    }
  }

  getPoints(geometry) {
    const edgePoints = geometry.getEdgePoints()
    const center = geometry.config.center

    const points = []
    let prevEdgePoint = edgePoints[0]
    for (let i = 1; i < edgePoints.length; i++) {
      const newEdgePoint = edgePoints[i]
      points.push(prevEdgePoint, newEdgePoint, center)
      prevEdgePoint = newEdgePoint
    }

    return points
  }

  getFragmentShader() {
    return `
      varying lowp float vBrightness;
      varying lowp vec4 vColor;

      void main(void)
      {
        gl_FragColor = vColor;
        gl_FragColor.xyz *= vBrightness;
      }
    `
  }

  getColor() {
    return this.config.color
  }
}

class EdgeMaterial {
  drawMode = 'LINES'

  constructor(config = {}) {
    this.config = {
      color: new RGBColor(255, 0, 0),
      ...config,
    }
  }

  getPoints(geometry) {
    const edgePoints = geometry.getEdgePoints()

    const points = []
    let prevEdgePoint = edgePoints[0]
    for (let i = 1; i < edgePoints.length; i++) {
      const newEdgePoint = edgePoints[i]
      points.push(prevEdgePoint, newEdgePoint)
      prevEdgePoint = newEdgePoint
    }

    return points
  }

  getFragmentShader() {
    return `
      varying lowp vec4 vColor;
      
      void main(void)
      {
        gl_FragColor = vColor;
      }
    `
  }

  getColor() {
    return this.config.color
  }
}

class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry.clone()
    this.material = material
  }

  getBrightness(surface) {
    const surfaceNormal = surface.config.normal
    const lightSource = new Vector3(0, 0.1, -1) // towards camera
    const brightness = lerp(0.3, 1, Math.abs(lightSource.dotProduct(surfaceNormal)))
    return brightness
  }

  getSurfaces() {
    return this.geometry.getSurfaces().map(surface => ({
      points: this.material.getPoints(surface),
      brightness: this.getBrightness(surface)
    }))
  }

  getDrawMode() {
    return this.material.drawMode
  }

  getFragmentShader() {
    return this.material.getFragmentShader()
  }

  rotate(vec3) {
    this.geometry.rotate(vec3)
  }

  translate(vec3) {
    this.geometry.config.center.add(vec3)
  }

  getColor() {
    return this.material.getColor()
  }
}

// COLORS

// HTML ELEMENTS
const canvas = document.getElementsByTagName('canvas')[0]

// SCENE
const scene = new Scene(canvas)
const clock = new Clock()

// MATERIALS
const solidPurpleMaterial = new SolidMaterial({
  color: new RGBColor(150, 0, 200)
})
const edgePurpleMaterial = new EdgeMaterial({
  color: new RGBColor(150, 0, 200)
})

// GEOMETRIES
const cubeGeometry = new CubeGeometry({
  size: 0.5,
})

// OBJECTS
const polygoneGeometry = new Polygon({
  sides: 6,
  radius: 0.5,
})
const polygoneMesh = new Mesh(polygoneGeometry, solidPurpleMaterial)
// scene.add(polygoneMesh)

const cubeMesh1 = new Mesh(cubeGeometry, edgePurpleMaterial)
scene.add(cubeMesh1)
const cubeMesh2 = new Mesh(cubeGeometry, solidPurpleMaterial)
scene.add(cubeMesh2)

cubeMesh1.translate(new Vector3(0.5, 0, 0))
cubeMesh2.translate(new Vector3(-0.5, 0, 0))

// START RENDER LOOP
let prevTime = window.performance.now()

function start() {
  cubeMesh1.rotate(new Vector3(0.01, 0.01, 0))
  cubeMesh2.rotate(new Vector3(0.01, 0.01, 0))

  cubeMesh1.material.config.color.shiftHue(0.5)
  cubeMesh2.material.config.color.shiftHue(0.5)

  scene.render(clock.delta())
  window.requestAnimationFrame(start)
}
start()
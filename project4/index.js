function clamp(min, val, max) {
  return Math.max(Math.min(max, val), min)
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
}

class Clock {
  delta() {
    const now = window.performance.now()
    const delta = now - (this.prevTime || now)
    this.prevTime = now
    return delta/20
  }
}

class Vector3 {
  constructor(x, y, z = 0) {
    this.x = x
    this.y = y
    this.z = z
  }

  rotate(vect3) {
    const angleX = vect3.x
    const angleY = vect3.y
    const angleZ = vect3.z

    if (angleX !== 0) {
      const { y, z } = this
      this.z = (z * Math.cos(angleX)) - (y * Math.sin(angleX));
      this.y = (z * Math.sin(angleX)) + (y * Math.cos(angleX));
    }

    if (angleY !== 0) {
      const { x, z } = this
      this.x = (x * Math.cos(angleY)) - (z * Math.sin(angleY));
      this.z = (x * Math.sin(angleY)) + (z * Math.cos(angleY));
    }

    if (angleZ !== 0) {
      const { x, y } = this
      this.x = (x * Math.cos(angleZ)) - (y * Math.sin(angleZ));
      this.y = (x * Math.sin(angleZ)) + (y * Math.cos(angleZ));
    }
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

class Polygon {
  constructor(config) {
    this.config = {
      radius: 1,
      sides: 40,
      // Idk what to call this, but 
      // it's spokes like a bycycle wheel
      spokes: false,
      // Edge lines that make up the polygon
      edges: true,
      center: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      color: new RGBColor(255,255,255),
      ...config,
    }
  }

  getEdgePoints() {
    const { sides, radius, rotation } = this.config

    const edgePoint = new Vector3(0, 0, 0)
    edgePoint.x += radius
    const edgePoints = []

    // rotate spokes 360 degress to get shape spacing each evenly
    const radians = Math.PI * 2 / sides
    const rotationVector = new Vector3(0, 0, radians)

    // change the starting point of our 360 degree spoke rotation
    edgePoint.rotate(new Vector3(0, 0, rotation.z))

    // we want to apply the initial rotation without z
    const rotationWithoutZ = rotation.clone()
    rotationWithoutZ.z = 0

    for (let i = 0; i <= sides; i++) {
      const newPoint = edgePoint.clone()
      newPoint.rotate(rotationWithoutZ)
      edgePoints.push(newPoint)
      edgePoint.rotate(rotationVector)
    }

    this.edgePoints = edgePoints
    return edgePoints
  }

  render(scene) {
    const { sides, spokes, edges, center, color } = this.config

    const edgePoints = this.getEdgePoints()
    edgePoints.map(edge => edge.add(center))
    // connect edges to center
    if (spokes) {
      for (const edgePoint of edgePoints) {
        scene.addLine(center, edgePoint, color)
      }
    }
    // connect edges to form circle
    if (edges && sides > 1) {
      for (let i = 0; i < sides; i++) {
        let [p1, p2] = edgePoints.slice(i, i + 2)
        scene.addLine(p1, p2, color)
      }
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
    return new Polygon(configClone)
  }
}

class FerrisWheel {
  wheels = []
  stands = []
  seats = []

  constructor(config = {}) {
    this.config = {
      radius: 1,
      sides: 40,
      // Idk what to call this, but 
      // it's spokes like a bycycle wheel
      spokes: false,
      // Edge lines that make up the polygon
      edges: true,
      center: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      // Colors
      wheelColor: new RGBColor(255,255,255),
      standColor: new RGBColor(255,255,255),
      seatColor: new RGBColor(255,255,255), 
      rotateSeatIndex: 0,
      ...config,
    }
    this.createObjects()
  }

  createObjects() {
    const { center, sides, wheelColor, standColor, seatColor } = this.config
    const DEPTH = Math.min(0.2 / (sides/20), 0.2)
    const SIZE = 0.5

    const WHEEL_DEPTH = DEPTH
    const STAND_DEPTH = DEPTH * 1.05
    const STAND_HEIGHT = SIZE * 0.75

    const wheel = new Polygon({
      radius: SIZE,
      sides,
      spokes: true,
      center,
      color: wheelColor
    })

    const wheel1 = wheel.clone()
    wheel1.config.center.z += WHEEL_DEPTH / 2
    const wheel2 = wheel.clone()
    wheel2.config.center.z -= WHEEL_DEPTH / 2
    this.wheels.push(wheel1, wheel2)

    const standCenter = center.clone()
    standCenter.y -= STAND_HEIGHT

    const stand = new Polygon({
      radius: STAND_HEIGHT,
      sides: 3,
      rotation: new Vector3(0, 0, Math.PI / 2),
      center: standCenter,
      color: standColor
    })

    const stand1 = stand.clone()
    stand1.config.center.z += STAND_DEPTH / 2

    const stand2 = stand.clone()
    stand2.config.center.z -= STAND_DEPTH / 2

    this.stands.push(stand1, stand2)

    const seat = new Polygon({
      radius: Math.min(1/sides, 0.2),
      sides: 3,
      rotation: new Vector3(0, 0, Math.PI / 2),
      color: seatColor
    })

    for (let i = 0; i < sides * 2; i++) {
      const newseat = seat.clone()
      this.seats.push(newseat)
    }
  }

  updateObjects(timeDelta) {
    // const ROTATE_X = 0
    const ROTATE_Y = 0.003 * timeDelta
    const ROTATE_Z = 0.01 * timeDelta

    for (const object of this.wheels) {
      object.config.rotation.add(new Vector3(0, ROTATE_Y, ROTATE_Z))
      object.config.center.rotate(new Vector3(0, ROTATE_Y, 0))
    }

    for (const object of this.stands) {
      object.config.rotation.add(new Vector3(0, ROTATE_Y, 0))
      object.config.center.rotate(new Vector3(0, ROTATE_Y, 0))
    }

    let i = 0
    for (const object of this.seats) {
      object.config.rotation.add(new Vector3(0, ROTATE_Y, 0))
      object.config.center.rotate(new Vector3(0, ROTATE_Y, 0))
      if (i === this.config.rotateSeatIndex*2 || i === this.config.rotateSeatIndex*2+1) {
        object.config.rotation.z += 0.05
      }
      i++
    }
  }

  render(scene, timeDelta) {
    const { sides, wheelColor, seatColor, standColor } = this.config

    this.updateObjects(timeDelta)
    // drawy wheels
    for (const object of this.wheels) {
      object.render(scene)
    }
    // connect wheels
    for (let i = 0; i < sides; i++) {
      const p1 = this.wheels[0].edgePoints[i]
      const p2 = this.wheels[1].edgePoints[i]
      // update seat positions
      this.seats[i * 2].config.center = p1
      this.seats[i * 2 + 1].config.center = p2
      scene.addLine(p1, p2, wheelColor)
    }
    // draw stands
    for (const object of this.stands) {
      object.render(scene)
    }
    // connect stand
    for (let i = 0; i < 3; i++) {
      const p1 = this.stands[0].edgePoints[i]
      const p2 = this.stands[1].edgePoints[i]
      scene.addLine(p1, p2, standColor)
    }
    // draw seats
    for (const object of this.seats) {
      object.render(scene)
    }
    // connect seats
    for (let i = 0; i < sides; i++) {
      for (let j = 0; j < 3; j++) {
        const p1 = this.seats[i * 2].edgePoints[j]
        const p2 = this.seats[i * 2 + 1].edgePoints[j]
        scene.addLine(p1, p2, seatColor)
      }
    }
  }
}

// COLORS

// HTML ELEMENTS
const canvas = document.getElementsByTagName('canvas')[0]
const numSeatSlider = document.getElementById('numSeatSlider')
const rotateSeatSlider = document.getElementById('rotateSeatSlider')

// SCENE
const scene = new Scene(canvas)
const clock = new Clock()

// OBJECTS
let seats = -1
let ferrisWheel

// START RENDER LOOP
let prevTime = window.performance.now()
function start() {
  const newSeats = parseInt(numSeatSlider.value)

  if (newSeats !== seats || !ferrisWheel) {
    seats = newSeats
    scene.remove(ferrisWheel)
    ferrisWheel = new FerrisWheel({
      sides: seats,
      wheelColor: new RGBColor(138, 66, 245),
      standColor: new RGBColor(245, 66, 242),
      seatColor: new RGBColor(66, 227, 245)
    })
    scene.add(ferrisWheel)
  }

  ferrisWheel.config.rotateSeatIndex = clamp(0, parseInt(rotateSeatSlider.value), seats-1)

  scene.render(clock.delta())
  window.requestAnimationFrame(start)
}
start()
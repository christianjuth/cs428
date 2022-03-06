// I like to name things, so here are the colors we will use
const SHADER_WHITE = [1.0, 1.0, 1.0, 1.0]
const SHADER_BLACK = [0.0, 0.0, 0.0, 1.0]

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

class Word {
  gl = null
  canvas = null
  shaderProgram = null
  vertices = []
  points = []
  resetShaders = () => { }
  characterSize = 8
  onResize = () => { }

  // Array of functions that get run when we .destroy() the maze
  teardownFns = []

  edgeShaders() {
    return {
      [this.gl.VERTEX_SHADER]: `
        attribute vec3 coordinates;
        void main(void)
        {
          gl_Position = vec4(coordinates, 1.0);
        }
      `,
      [this.gl.FRAGMENT_SHADER]: `
        void main(void)
        {
          gl_FragColor = vec4(${SHADER_WHITE.join(',')});
        }
      `
    }
  }

  pointShaders() {
    return {
      [this.gl.VERTEX_SHADER]: `
        attribute vec3 coordinates;
        void main(void)
        {
          gl_Position = vec4(coordinates, 1.0);
          gl_PointSize = ${this.characterSize.toFixed(1)};
        }
      `,
      [this.gl.FRAGMENT_SHADER]: `
        void main(void)
        {
          gl_FragColor = vec4(${SHADER_WHITE.join(',')});
        }
      `
    }
  }

  constructor(canvas, dataSize) {
    this.dataSize = dataSize
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
    const { canvas, gl, dataSize } = this
    canvas.height = canvas.offsetHeight
    canvas.width = canvas.offsetWidth
    const size = Math.max(canvas.height, canvas.width)
    this.characterSize = (size / dataSize) * 0.6
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

  addLine([x1, y1], [x2, y2]) {
    this.vertices.push(
      x1, y1, 0.0,
      x2, y2, 0.0
    )
  }

  addPoint([x, y]) {
    this.points.push(
      x, y, 0.0,
    )
  }

  render() {
    const { gl, shaderProgram, vertices, points } = this

    // reset
    gl.clearColor(...SHADER_BLACK);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // end reset

    this.loadShaders(this.edgeShaders())

    const coord = gl.getAttribLocation(shaderProgram, "coordinates");

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(coord);

    gl.enable(gl.DEPTH_TEST);

    gl.drawArrays(gl.LINES, 0, vertices.length / 3);

    this.loadShaders(this.pointShaders())

    const pointBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);

    gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(coord);

    gl.enable(gl.DEPTH_TEST);

    gl.drawArrays(gl.POINTS, 0, 1);

    this.vertices = []
    this.points = []
  }

  destroy() {
    for (const fn of this.teardownFns) {
      fn()
    }
  }
}

// We don't really need to do this
// But I like to name things and this
// ensures I don't do something stupid
// like stack.unshift()
class Stack {
  data = []
  add(item) {
    this.data.push(item)
  }
  pop() {
    return this.data.pop()
  }
  isEmpty() {
    return this.data.length === 0
  }
}

class MazeCell {
  topEdge = true
  rightEdge = true
  bottomEdge = true
  leftEdge = true
  visited = false

  constructor(x, y) {
    this.x = x
    this.y = y
  }
}

class Maze {
  data = []
  world = null
  character = [0, 0]

  // Array of functions that get run when we .destroy() the maze
  teardownFns = []

  constructor(canvas, n, m) {
    const size = Math.max(n, m)
    const world = new Word(canvas, size)
    world.onResize = () => this.render()

    this.teardownFns.push(() => {
      world.destroy()
    })

    // THIS IS A HACK
    // The joke is centering things using CSS is one of the
    // hardest problems with web development. Please excuse this hack.
    // I know there are better way to do this.
    world.canvas.style.transform = `translate(-${n * 50 / size}%,-${m * 50 / size}%)`

    this.n = n
    this.m = m
    this.world = world
    this.data = new Array(m).fill(0).map((_, y) => new Array(n).fill(0).map((_, x) => new MazeCell(x, y)))

    const vertCenter = Math.round(m / 2)
    this.data[vertCenter][0].leftEdge = false
    this.character = [-1, vertCenter]

    this.data[vertCenter][n - 1].rightEdge = false

    this.generate()
    this.render()
    this.enableMovement()
  }

  moveCharacter(direction) {
    const [x, y] = this.character
    const cell = this.data[y][x] ?? {}

    switch (direction) {
      case 'up':
        if (!cell.topEdge) {
          this.character[1] = Math.max(this.character[1] - 1, 0)
          this.render()
        }
        break;
      case 'right':
        if (!cell.rightEdge) {
          this.character[0] = Math.min(this.character[0] + 1, this.n)
          this.render()
        }
        break;
      case 'down':
        if (!cell.bottomEdge) {
          this.character[1] = Math.min(this.character[1] + 1, this.m - 1)
          this.render()
        }
        break;
      case 'left':
        if (!cell.leftEdge) {
          this.character[0] = Math.max(this.character[0] - 1, -1)
          this.render()
        }
        break;
    }
  }

  enableMovement() {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'w':
        case 'ArrowUp':
          e.preventDefault()
          this.moveCharacter('up')
          break;
        case 'd':
        case 'ArrowRight':
          e.preventDefault()
          this.moveCharacter('right')
          break;
        case 's':
        case 'ArrowDown':
          e.preventDefault()
          this.moveCharacter('down')
          break;
        case 'a':
        case 'ArrowLeft':
          e.preventDefault()
          this.moveCharacter('left')
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    this.teardownFns.push(() => {
      window.removeEventListener('keydown', handleKeyDown)
    })
  }

  getNeighbors(x, y) {
    const coords = [
      [x, y - 1, 'up'],
      [x + 1, y, 'right'],
      [x, y + 1, 'down'],
      [x - 1, y, 'left'],
    ]

    // Shuffling neighbors makes our maze random so 
    // each time we load the page we get a unique maze
    shuffleArray(coords)

    // Locate adjacent nodes. JavaScript doesn't throw out of index errors,
    // which makes our job easier. However we can't index undefined, which is
    // why I'm using optional chaining for data[y]?.[x] in case y is out of index.
    // Finally we filter out neightbors that don't exsist.
    return coords.map(([x, y, direction]) => [this.data[y]?.[x], direction]).filter(([node]) => node !== undefined)
  }

  generate() {
    const stack = new Stack()

    // start search at the top left corner
    stack.add([this.data[0][0], () => { }])

    while (!stack.isEmpty()) {
      const [node, removeEdge] = stack.pop()
      const { x, y } = node

      if (node.visited) {
        continue
      }

      removeEdge()
      node.visited = true

      for (const [neighbor, direction] of this.getNeighbors(x, y)) {
        if (!neighbor.visited) {

          const removeEdge = () => {
            switch (direction) {
              case 'up':
                node.topEdge = false
                neighbor.bottomEdge = false
                break;
              case 'right':
                node.rightEdge = false
                neighbor.leftEdge = false
                break;
              case 'down':
                node.bottomEdge = false
                neighbor.topEdge = false
                break;
              case 'left':
                node.leftEdge = false
                neighbor.rightEdge = false
                break;
            }
          }
          stack.add([neighbor, removeEdge])
        }
      }
    }
  }

  render() {
    const { world, n, m } = this
    const size = Math.max(n, m) + 2

    // Remap our [0, n], [0, m] ranges to the [-1, 1] ranges 
    // that our WebGL wrapper class World expects
    // We also pad both ranges by one allowing the rat to exit the map.
    // In other words, the maze does not go edge to edge within the canvas.
    const normalizeX = (val) => ((val + 1) * 2 / size) - 1
    // -2 flips the y axis so its renders in the correct orientation
    const normalizeY = (val) => ((val + 1) * -2 / size) + 1

    const [characterX, characterY] = this.character
    world.addPoint([normalizeX(characterX + 0.5), normalizeY(characterY + 0.5)])

    for (let y = 0; y < m; y++) {
      for (let x = 0; x < n; x++) {
        const cell = this.data[y][x]

        // Get points surrounding the current cell
        const topLeftPt = [normalizeX(x), normalizeY(y)]
        // Top right
        const topRightPt = [normalizeX(x + 1), normalizeY(y)]
        // Bottom right
        const bottomRightPt = [normalizeX(x + 1), normalizeY(y + 1)]
        // Bottom left
        const bottomLeftPt = [normalizeX(x), normalizeY(y + 1)]

        if (cell.topEdge) {
          world.addLine(topLeftPt, topRightPt)
        }
        if (cell.rightEdge) {
          world.addLine(topRightPt, bottomRightPt)
        }
        if (cell.bottomEdge) {
          world.addLine(bottomRightPt, bottomLeftPt)
        }
        if (cell.leftEdge) {
          world.addLine(bottomLeftPt, topLeftPt)
        }
      }
    }

    world.render()
  }

  destroy() {
    for (const fn of this.teardownFns) {
      fn()
    }
  }
}


const canvas = document.getElementsByTagName('canvas')[0]

const nSlider = document.getElementById('nSlider')
const mSlider = document.getElementById('mSlider')

let maze = null

function start() {
  if (maze) {
    maze.destroy()
  }
  const N = Math.min(Math.max(parseInt(nSlider.value, 10), 2), 500)
  const M = Math.min(Math.max(parseInt(mSlider.value, 10), 2), 500)
  if (parseInt(nSlider.value) !== N) {
    nSlider.value = N
  }
  if (parseInt(mSlider.value) !== M) {
    mSlider.value = M
  }
  maze = new Maze(canvas, N, M)
}

start()

nSlider.addEventListener('change', start)
mSlider.addEventListener('change', start)
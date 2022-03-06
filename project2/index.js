
const SIZE = 800

const canvas = document.getElementsByTagName('canvas')[0]

canvas.height = SIZE
canvas.width = SIZE

const ctx = canvas.getContext('2d')
const slider = document.getElementById('slider')

function line([x1, y1], [x2, y2], color = '#000000') {
  // x1 = Math.round(x1)
  // y1 = Math.round(y1)
  // x2 = Math.round(x2)
  // y2 = Math.round(y2)
  ctx.beginPath();
  ctx.strokeStyle = color
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function movePointInDirection([x, y], deg, distance) {
  const newX = x + distance * Math.cos(deg * Math.PI / 180)
  const newY = y + distance * Math.sin(deg * Math.PI / 180)
  return [newX, newY]
}

function disatanceBetweenPoints([x1, y1], [x2, y2]) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

function radToDeg(rad) {
  return rad * (180 / Math.PI)
}

function angleFromPoints([x1, y1], [x2, y2]) {
  const deg = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 180
  return (deg + 180) % 360
}

/**
 * Draw a triangle starting from the bottom left point
 */
function triangle([x1, y1], [x2, y2], draw = true) {
  ctx.beginPath();

  const sideLen = disatanceBetweenPoints([x1, y1], [x2, y2])
  const height = triangeHeightFromSide(sideLen)

  let centerPt = [x1, y1]
  let angle = angleFromPoints([x1, y1], [x2, y2])

  centerPt = movePointInDirection(centerPt, angle, sideLen / 2)
  angle = (angle - 90) % 360
  centerPt = movePointInDirection(centerPt, angle, height)

  let p1 = [x1, y1]
  let p2 = centerPt
  let p3 = [x2, y2]
  if (draw) {
    // line(p1, p3)
    line(p1, p2)
    line(p2, p3)
  }
  ctx.stroke();

  return [p1, p2, p3]
}

function getCenterThird(p1, p2) {
  const angle = angleFromPoints(p1, p2)
  const distance = disatanceBetweenPoints(p1, p2)
  const newP1 = movePointInDirection(p1, angle, distance / 3)
  const newP2 = movePointInDirection(newP1, angle, distance / 3)
  return [newP1, newP2]
}

function triangleOnThird(p1, p2, depth) {
  const [segPt1, segPt2] = getCenterThird(p1, p2)
  rec(segPt1, segPt2, depth, false)

  if (depth > 1) {
    triangleOnThird(p1, segPt1, depth - 1)
    triangleOnThird(segPt2, p2, depth - 1)
  } else {
    line(p1, segPt1)
    line(segPt2, p2)
  }
  return [segPt1, segPt2]
}

function triangeHeightFromSide(len) {
  return len * Math.sqrt(3) / 2
}

function rec(p1, p2, depth, top = true) {
  if (depth === 1) {
    triangle(p1, p2, true)
    if (top) {
      line(p1, p2)
    }
    return
  }

  if (depth <= 0) {
    return
  }

  const [tPt1, tPt2, tPt3] = triangle(p1, p2, false)

  triangleOnThird(tPt1, tPt2, depth - 1)
  triangleOnThird(tPt2, tPt3, depth - 1)
  if (top) {
    triangleOnThird(tPt3, tPt1, depth - 1)
  }
}


function paint() {
  const depth = parseInt(slider.value)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, SIZE, SIZE);

  const padding = SIZE * 0.15
  const sideLen = SIZE - (padding * 2)
  const height = triangeHeightFromSide(sideLen)

  const left = padding
  const top = (padding / 2) + height

  const bottomLeftPt = [left, top]
  const bottomRightPt = [left + sideLen, top]

  rec(bottomLeftPt, bottomRightPt, depth)
}

paint()

let timeoutId = 0
function handleChange() {
  clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    paint()
  }, 200)
}
slider.addEventListener('change', handleChange)
const app = new PIXI.Application({ resizeTo: window });
document.body.appendChild(app.view);

const fragShader = `
  varying vec2 vTextureCoord;
  uniform float time;

  // takes any float as input and
  // ossolates smoothly between 0 and 1
  float oscillate(float val) {
    return (sin(val) + 1.0) / 2.0;
  }

  void main() {
    float red = oscillate(vTextureCoord.x + time);
    float green = oscillate(vTextureCoord.y + time);
    float blue = oscillate(time);
    gl_FragColor = vec4(red, green, blue, 1.0);
  }
`

const shader = new PIXI.Filter(undefined, fragShader, { 
  time: 0.0,
})

app.stage.filters = [shader]
app.stage.filterArea = app.screen 

app.ticker.add((delta) => {
  shader.uniforms.time += delta / 100
})
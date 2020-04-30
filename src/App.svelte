<script context="module">
  function downloadFile(filename) {
    return fetch(`http://localhost:3000/mesh/${filename}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      }
    })
      .then(res => {
        return res.text();
      })
      .catch(err => console.log(err));
  }

  const vsSource = `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      gl_PointSize = 1.0;
    }
  `;

  const fsSource = `
    void main() {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `;

  const vsSource2 = `
    attribute vec2 a_position;
    uniform mat3 u_matrix;

    void main() {
      gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy, 0, 1);
    }
  `;

  const fsSource2 = `
    precision mediump float;
 
    void main() {
      gl_FragColor = vec4(1, 0, 0.5, 1);
    }
  `;
</script>

<script>
  import { onMount, onDestroy } from "svelte";

  class Camera {
    constructor() {
      this._vposition = vec3.create();
      this._vdirection = vec3.create();
      this._camMat = mat4.create();
      this._camRadX = 0.0;
      this._camRadY = 0.0;
      vec3.set(this._vdirection, 0, 0, -1);
      this.setPosition = this.setPosition.bind(this);
      this.getPosition = this.getPosition.bind(this);
      this.getViewMatrix = this.getViewMatrix.bind(this);
      this.turnRadY = this.turnRadY.bind(this);
      this.moveZ = this.moveZ.bind(this);
      this.moveX = this.moveX.bind(this);
    }
    setPosition(position) {
      if (position) {
        console.log("setting position");
        console.log(position);
        vec3.set(this._vposition, position[0], position[1], position[2]);
        console.log(this._vposition);
      }
    }
    getPosition() {
      return this._vposition;
    }
    setTarget(target) {
      if (target) {
      }
    }
    getTarget() {}
    getViewMatrix(matrix) {
      if (matrix) {
        mat4.fromTranslation(this._camMat, this._vposition);
        mat4.rotate(this._camMat, this._camMat, this._camRadY, [0, 1, 0]);
        mat4.invert(matrix, this._camMat);
      }
    }
    turnRadY(rad) {
      if (rad) {
        this._camRadY += rad;
        vec3.rotateY(this._vdirection, this._vdirection, [0, 0, 0], rad);
      }
    }
    moveZ(delta) {
      if (delta) {
        let vdisplacement = vec3.create();
        vec3.scale(vdisplacement, this._vdirection, delta);
        vec3.add(this._vposition, this._vposition, vdisplacement);
      }
    }
    moveX(delta) {
      let cross = vec3.create();
      let vdisplacement = vec3.create();
      vec3.cross(cross, this._vdirection, [0, 1, 0]);
      vec3.scale(vdisplacement, cross, delta);
      vec3.add(this._vposition, this._vposition, vdisplacement);
    }
    moveY(delta) {
      let vdisplacement = vec3.create();
      vec3.scale(vdisplacement, [0, 1, 0], delta);
      vec3.add(this._vposition, this._vposition, vdisplacement);
    }
  }

  class LinearRamp {
    constructor() {
      this._step = 1.0;
      this.interval = 1000.0;
      this.duration = 0.0;
      this.rampFunc = this.rampFunc.bind(this);
      this.resetDuration = this.resetDuration.bind(this);
    }
    rampFunc(timedelta) {
      if (timedelta == 0) {
        return 0;
      }
      this.duration += timedelta;
      if (this.duration >= this.interval) {
        return this._step * (timedelta / 1000); //steps per millisecond
      }
      return this._step * (timedelta / 1000) * (this.duration / this.interval);
    }
    resetDuration() {
      this.duration = 0.0;
    }
  }

  class SineRamp {
    constructor() {
      this._running = false;
      this._period = 1000.0;
      this.duration = 0.0;
      this._step = 0.1;
      this.isRunning = this.isRunning.bind(this);
      this.rampFunc = this.rampFunc.bind(this);
      this.resetDuration = this.resetDuration.bind(this);
      this.start = this.start.bind(this);
    }
    rampFunc(timedelta) {
      if (this._running) {
        this.duration += timedelta;
        if (timedelta == 0) {
          return 0;
        }
        if (this.duration >= this._period) {
          this.resetDuration();
          return 0;
        }
        const u =
          this._step * Math.cos(Math.PI * (this.duration / this._period));
        // console.log(u);
        return u;
      }
    }
    start() {
      this._running = true;
    }
    isRunning() {
      return this._running;
    }
    resetDuration() {
      console.log("SineRamp reset");
      this.duration = 0.0;
      this._running = false;
    }
  }

  let username;
  let x;
  let y;
  let isConnected = false;
  let interval;
  let canvas;
  let frame;
  let gl = null;
  let key;
  let keyCode;
  let color = "rgb(0, 0, 200)";
  let width = 40;
  let height = 40;
  let count = 0;
  let start = null;
  let fpsStart;
  let previousTime;
  let clonePlayers;
  let graphicsStatus;
  let fps;
  const positions2 = [10, 20, 80, 20, 10, 30, 10, 30, 80, 20, 80, 30];
  const projectionMatrix = mat4.create();
  let camera;
  let axisYMotionRamper;
  let zMotionRamper;
  let xMotionramper;
  let jumpMotionRamper;
  let targetPos = [0, 0, 0];
  let radY = 0.0;
  let keySet = new Set();

  let mesh = null;
  let bevCubeMesh = null;

  const files = {
    anvil: "anvil.obj",
    bevCube: "beveledcube.obj",
    egg: "egg.obj"
  };

  const nodeInfo = {
    anvil: null,
    bevCube: null,
    egg: null
  };

  const app = {
    meshes: {}
  };

  class Node2 {
    constructor() {
      this.children = [];
      this.worldMatrix = mat4.create();
      this.localMatrix = mat4.create();
      this.setParent = this.setParent.bind(this);
      this.drawInfo = {
        programInfo: null,
        mesh: null
      };
    }
    setParent(parent) {
      // remove us from our parent
      if (this.parent) {
        let ndx = this.parent.children.indexOf(this);
        if (ndx >= 0) {
          this.parent.children.splice(ndx, 1);
        }
      }
      if (parent) {
        //Prevent making a Node it's own parent
        if (this === parent) {
          console.log("Can't be your own parent");
          return 0;
        }
        for (
          let upperParent = parent.parent;
          ;
          upperParent = upperParent.parent
        ) {
          if (!upperParent) {
            break;
          }
          if (this === upperParent) {
            console.log("This Node Can't be it's own Grandparent");
            return 0;
          }
          // upperParent = upperParent.parent;
          console.log("in loop...");
        }
        parent.children.push(this);
      }
      this.parent = parent;
    }
  }

  function computeWorldMatrix(currentNode, parentWorldMatrix){
    const worldMatrix = mat4.create();
    mat4.mul(worldMatrix, parentWorldMatrix, currentNode.localMatrix);
    if (currentNode.children.length){
      currentNode.children.forEach( child =>{
        computeWorldMatrix(child, worldMatrix);
      })
    }
  }

  function renderNodeGraph(
    gl,
    node,
    previousProgram,
    projectionMatrix,
    modelViewMatrix
  ) {
    if (Object.keys(node.drawInfo).length) {
      if (
        !previousProgram ||
        previousProgram !== node.drawInfo.programInfo.program
      ) {
        gl.useProgram(node.drawInfo.programInfo.program);
        gl.uniformMatrix4fv(
          node.drawInfo.programInfo.uniformLocations.projectionMatrix,
          false,
          projectionMatrix
        );
        gl.uniformMatrix4fv(
          node.drawInfo.programInfo.uniformLocations.modelViewMatrix,
          false,
          modelViewMatrix
        );
        gl.enableVertexAttribArray(
          node.drawInfo.programInfo.attribLocations.vertexPosition
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, node.drawInfo.mesh.vertexBuffer);
        gl.vertexAttribPointer(
          node.drawInfo.programInfo.attribLocations.vertexPosition,
          node.drawInfo.mesh.vertexBuffer.itemSize,
          gl.FLOAT,
          false,
          0,
          0
        );
      }
      //Draw this node
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, node.drawInfo.mesh.indexBuffer);
      gl.drawElements(
        gl.LINES,
        node.drawInfo.mesh.indexBuffer.numItems,
        gl.UNSIGNED_SHORT,
        0
      );
    }
    if (node.children.length) {
      node.children.forEach(childNode => {
        renderNodeGraph(
          gl,
          childNode,
          previousProgram,
          projectionMatrix,
          modelViewMatrix
        );
      });
    }
  }

  const programInfo = {
    program: null,
    attribLocations: null,
    uniformLocations: {
      projectionMatrix: null,
      modelViewMatrix: null
    }
  };
  const program2Info = {
    program: null,
    positionAttributeLocation: null
  };

  function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    // Create the shader program

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // If creating the shader program failed, alert

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert(
        "Unable to initialize the shader program: " +
          gl.getProgramInfoLog(shaderProgram)
      );
      return null;
    }

    return shaderProgram;
  }

  //
  // creates a shader of the given type, uploads the source and
  // compiles it.
  //
  function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    // Send the source to the shader object

    gl.shaderSource(shader, source);

    // Compile the shader program

    gl.compileShader(shader);

    // See if it compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(
        "An error occurred compiling the shaders: " +
          gl.getShaderInfoLog(shader)
      );
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  function draw(timestamp) {
    if (!start) {
      start = timestamp;
      previousTime = timestamp;
      console.log(app.meshes);
    }
    const timedelta = timestamp - previousTime;
    // resize(gl.canvas);
    const fieldOfView = (45 * Math.PI) / 180; // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
    if (jumpMotionRamper.isRunning()) {
      camera.moveY(jumpMotionRamper.rampFunc(timedelta));
    }
    if (keySet.size) {
      for (let code of keySet) {
        if (code == 37) {
          camera.turnRadY(
            glMatrix.toRadian(axisYMotionRamper.rampFunc(timedelta))
          );
        } else if (code == 39) {
          camera.turnRadY(
            -glMatrix.toRadian(axisYMotionRamper.rampFunc(timedelta))
          );
        }
        if (code == 38) {
          camera.moveZ(zMotionRamper.rampFunc(timedelta));
        } else if (code == 40) {
          camera.moveZ(-zMotionRamper.rampFunc(timedelta));
        }
        if (code == 68) {
          //d, go right
          camera.moveX(xMotionramper.rampFunc(timedelta));
        } else if (code == 65) {
          camera.moveX(-xMotionramper.rampFunc(timedelta));
        }
      }
      // console.log(keySet);
    }
    const worldMatrix = mat4.create();
    computeWorldMatrix(nodeInfo["anvil"], worldMatrix)
    const modelViewMatrix = mat4.create();
    camera.getViewMatrix(modelViewMatrix);
    frameRate(timestamp);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    renderNodeGraph(
      gl,
      nodeInfo["anvil"],
      null,
      projectionMatrix,
      modelViewMatrix
    );

    gl.useProgram(program2Info.program);
    let u_matrix = mat3.fromValues(
      2 / gl.canvas.width,
      0,
      0,
      0,
      -2 / gl.canvas.height,
      0,
      -1,
      1,
      1
    );
    gl.uniformMatrix3fv(
      program2Info.resolutionUniformLocation,
      false,
      u_matrix
    );
    gl.enableVertexAttribArray(program2Info.positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, program2Info.buffers.posBuffer);
    gl.vertexAttribPointer(
      program2Info.positionAttributeLocation,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    previousTime = timestamp;
    requestAnimationFrame(draw);
  }

  function rampMotion(max, tracked, multiplier = 1.1) {
    if (!tracked) {
      throw new Error("rampMotion tracked parameter not provided");
    }
    return function() {
      tracked.delta *= 1.1;
      if (tracked.delta > max) {
        tracked.delta = max;
      }
      return tracked.delta;
    };
  }

  function drawPlayers() {
    if (!clonePlayers) {
      return;
    }
    gl.fillStyle = "rgb(0, 0, 0)";
    gl.fillRect(0, 0, 300, 300);
    for (let player of clonePlayers) {
      if (player.username == username) {
        gl.fillStyle = color;
        gl.fillRect(player.x - 20, 240, width, height);
        continue;
      }
      gl.fillStyle = "rgb(200, 0, 0)";
      gl.fillRect(player.x - 20, 20, width, height);
    }
  }

  async function connect() {
    if (!username) {
      return;
    }
    let res = await fetch("http://localhost:3000", {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: JSON.stringify({
        user: username
      })
    });
    if (res.ok) {
      let json = await res.json();
      // console.log(json);
      if (json.error) {
        console.log(`error: ${json.error}`);
        return;
      }
      isConnected = true;
      x = json.position.x;
      y = json.position.y;

      interval = setInterval(() => {
        getPlayers().then(players => {
          // console.log(players);
          clonePlayers = players;
          updatePlayer({
            username: username,
            x: x,
            y: y
          });
        });
      }, 40);
      return;
    }
    console.log(`status: ${res.status}`);
  }

  function disconnect() {
    isConnected = false;
    username = null;
    clonePlayers = null;
    console.log("Disconnect");
    clearInterval(interval);
  }

  onMount(() => {
    console.log("onMount");
    gl = canvas.getContext("webgl");
    if (gl === null) {
      graphicsStatus = "No webGl";
      return;
    }
    camera = new Camera();
    camera.setPosition([0, 0, 10]);
    axisYMotionRamper = new LinearRamp();
    axisYMotionRamper._step = 180;
    zMotionRamper = new LinearRamp();
    zMotionRamper._step = 5.0;
    zMotionRamper.interval = 500.0;
    xMotionramper = new LinearRamp();
    xMotionramper._step = 5.0;
    xMotionramper.interval = 500.0;
    jumpMotionRamper = new SineRamp();
    jumpMotionRamper._period = 700.0;
    graphicsStatus = "webGl ready";
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const shaderProgram2 = initShaderProgram(gl, vsSource2, fsSource2);
    programInfo.program = shaderProgram;
    programInfo.attribLocations = {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition")
    };
    programInfo.uniformLocations = {
      projectionMatrix: gl.getUniformLocation(
        shaderProgram,
        "uProjectionMatrix"
      ),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix")
    };
    program2Info.program = shaderProgram2;
    program2Info.positionAttributeLocation = gl.getAttribLocation(
      shaderProgram2,
      "a_position"
    );
    program2Info.resolutionUniformLocation = gl.getUniformLocation(
      shaderProgram2,
      "u_matrix"
    );
    program2Info.buffers = {};
    program2Info.buffers.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, program2Info.buffers.posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(positions2),
      gl.STATIC_DRAW
    );

    const fieldOfView = (45 * Math.PI) / 180; // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
    gl.clearDepth(1.0); // Clear everything
    gl.enable(gl.DEPTH_TEST); // Enable depth testing
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things

    const ksize = Object.keys(files).length;
    let kcount = 0;
    for (let name in files) {
      downloadFile(files[name])
        .then(result => {
          app.meshes[name] = new OBJ.Mesh(result);
          OBJ.initMeshBuffers(gl, app.meshes[name]);
          kcount += 1;
          console.log(kcount);
          if (kcount == ksize) {
            return true;
          } else {
            return false;
          }
        })
        .then(result => {
          if (result) {
            for (let name in nodeInfo) {
              nodeInfo[name] = new Node2();
              nodeInfo[name].drawInfo.mesh = app.meshes[name];
              nodeInfo[name].drawInfo.programInfo = programInfo;
            }
            nodeInfo["bevCube"].setParent(nodeInfo["anvil"]);
            nodeInfo["egg"].setParent(nodeInfo["anvil"]);
            console.log(nodeInfo);
            frame = requestAnimationFrame(draw);
          }
        });
    }
    return () => {
      cancelAnimationFrame(frame);
      // clearInterval(interval);
    };
  });

  function keydown(e) {
    if (camera) {
      // console.log(targetPos);
      keyCode = e.keyCode;
      if (keyCode == 37) {
        //LEFT ARROW
        keySet.add(keyCode);
      } else if (keyCode == 39) {
        //RIGHT ARROW
        keySet.add(keyCode);
      }
      if (keyCode == 38) {
        //up arrow
        keySet.add(keyCode);
      } else if (keyCode == 40) {
        //down arrow
        keySet.add(keyCode);
      }
      if (keyCode == 65) {
        //a
        keySet.add(keyCode); //d
      } else if (keyCode == 68) {
        keySet.add(keyCode);
      }
      if (keyCode == 69) {
        // e : jump
        jumpMotionRamper.start();
      }
      if (keyCode == 67) {
        // c
        console.log(camera.getPosition());
      }
      console.log(keyCode);
    }
  }

  function keyup(e) {
    if (camera) {
      let kcode = e.keyCode;
      if (kcode == 37 || 39) {
        keySet.delete(kcode);
        axisYMotionRamper.resetDuration();
      }
      if (kcode == 38 || 40) {
        keySet.delete(kcode);
        zMotionRamper.resetDuration();
      }
      if (kcode == 65 || 68) {
        keySet.delete(kcode);
        xMotionramper.resetDuration();
      }
    }
  }

  function frameRate(timestamp) {
    if(!fpsStart){
      fpsStart = timestamp;
    }
    if (count == 60) {
      let elapsed = timestamp - fpsStart;
      // console.log("fps: ", (count * 1000) / elapsed);
      fps = Math.round((count * 1000) / elapsed);
      fpsStart = timestamp;
      count = 0;
    }
    count += 1;
  }

  function loop(timestamp) {
    frameRate(timestamp);
    if (isConnected) {
      drawPlayers();
    } else {
      gl.fillStyle = "rgb(256, 256, 256)";
      gl.fillRect(0, 0, 300, 300);
    }
    requestAnimationFrame(loop);
  }

  async function getPlayers() {
    const res = await fetch("http://localhost:3000");
    if (res.ok) {
      const json = await res.json();
      return json;
    }
  }

  async function updatePlayer(player) {
    // console.log("update player");
    try {
      const res = await fetch("http://localhost:3000/players", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json;charset=utf-8"
        },
        body: JSON.stringify({
          player: {
            username: player.username,
            x: x,
            y: y
          }
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.error) {
          console.log(`json.error: ${json.error}`);
        }
      }
    } catch (e) {
      console.log(e.message);
    }
  }
</script>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  .container {
    position: relative;
    padding: 1em 0;
    margin: auto;
  }

  /* h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  } */

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }

  #overlay {
    color: cornflowerblue;
    position: absolute;
    left: 10px;
    top: 10px;
  }

  #canvas {
    width: 720px;
    height: 480px;
  }
</style>

<svelte:window on:keydown={keydown} on:keyup={keyup} />

<main>
  <div class="container">
    <span>{graphicsStatus}</span>
    {#if !isConnected}
      <label for="username">Username:</label>
      <input type="text" bind:value={username} id="username" />
    {/if}
    {#if isConnected}
      <button on:click={disconnect}>Disconnect</button>
    {:else}
      <button on:click={connect}>Connect</button>
    {/if}
  </div>
  <div class="container">
    <canvas bind:this={canvas} width="300px" height="300px" />
    <div id="overlay">
      {#if fps}
        <div>
          fps:
          <span>{fps}</span>
        </div>
      {/if}
    </div>
  </div>
</main>

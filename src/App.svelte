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
</script>

<script>
  import { onMount, onDestroy } from "svelte";
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
  let clonePlayers;
  let step = 1;
  let rampMax10 = rampMotion(10);
  let graphicsStatus;
  const positions2 = [
    10, 20,
    80, 20,
    10, 30,
    10, 30,
    80, 20,
    80, 30
  ];

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

  function initBuffers(gl) {
    // Create a buffer for the square's positions.

    const positionBuffer = gl.createBuffer();

    // Select the positionBuffer as the one to apply buffer
    // operations to from here out.

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Now create an array of positions for the square.

    const positions = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];

    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    return {
      position: positionBuffer
    };
  }

  function drawScene(gl, programInfo, buffers) {
    
  }

  function rampMotion(max) {
    return function() {
      step *= 2;
      if (step > max) {
        return max;
      } else {
        return step;
      }
    };
  }

  // $: {
  //   console.log(`x: ${x}, y: ${y}`);
  // }

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
    graphicsStatus = "webGl ready";
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const shaderProgram2 = initShaderProgram(gl, vsSource2, fsSource2);
    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition")
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(
          shaderProgram,
          "uProjectionMatrix"
        ),
        modelViewMatrix: gl.getUniformLocation(
          shaderProgram,
          "uModelViewMatrix"
        )
      }
    };
    const positionAttributeLocation = gl.getAttribLocation(
      shaderProgram2,
      "a_position"
    );
    const resolutionUniformLocation = gl.getUniformLocation(shaderProgram2, "u_matrix");
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(positions2),
      gl.STATIC_DRAW
    );
    // const buffers = initBuffers(gl);
    // drawScene(gl, programInfo, buffers);

    let houseModel = downloadFile('anvil.obj');
    const fieldOfView = (45 * Math.PI) / 180; // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    const modelViewMatrix = mat4.create();

    mat4.translate(
      modelViewMatrix, // destination matrix
      modelViewMatrix, // matrix to translate
      [0.0, 0.0, -10.0]
    ); // amount to translate

    houseModel.then(result => {
      // console.log(result);
      let mesh = new OBJ.Mesh(result);
      {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
        gl.clearDepth(1.0); // Clear everything
        gl.enable(gl.DEPTH_TEST); // Enable depth testing
        gl.depthFunc(gl.LEQUAL); // Near things obscure far things

        // Clear the canvas before we start drawing on it.

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(programInfo.program);

        gl.uniformMatrix4fv(
          programInfo.uniformLocations.projectionMatrix,
          false,
          projectionMatrix
        );
        gl.uniformMatrix4fv(
          programInfo.uniformLocations.modelViewMatrix,
          false,
          modelViewMatrix
        );
        OBJ.initMeshBuffers(gl, mesh);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
        gl.vertexAttribPointer(
          programInfo.attribLocations.vertexPosition,
          mesh.vertexBuffer.itemSize,
          gl.FLOAT,
          false, 0, 0
        );
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        gl.drawElements(gl.LINE_LOOP, mesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
      }
      gl.useProgram(shaderProgram2);
      let u_matrix = mat3.fromValues(2/gl.canvas.width, 0, 0, 0, -2/gl.canvas.height, 0, -1, 1, 1);
      gl.uniformMatrix3fv(resolutionUniformLocation, false, u_matrix);
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.vertexAttribPointer(
        positionAttributeLocation,
        2,
        gl.FLOAT,
        false,
        0,
        0
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });

    // frame = requestAnimationFrame(loop);

    // return () => {
    //   cancelAnimationFrame(frame);
    //   clearInterval(interval);
    // };
  });

  function keydown(e) {
    if (isConnected) {
      keyCode = e.keyCode;
      switch (keyCode) {
        case 37: //LEFT ARROW
          // x -= 3;
          if (x == 20) {
            break;
          }
          x -= rampMax10();
          if (x < 20) {
            x = 20;
          }
          break;
        case 39: //RIGHT ARROW
          // x += 3;
          if (x == 280) {
            break;
          }
          x += rampMax10();
          if (x > 280) {
            x = 280;
          }
          break;
        default:
      }
    }
  }

  function keyup(e) {
    if (isConnected) {
      let kcode = e.keyCode;
      switch (kcode) {
        case 37:
        case 39:
          step = 1;
        default:
      }
    }
  }

  function loop(timestamp) {
    if (!start) {
      start = timestamp;
    }
    if (count == 180) {
      let elapsed = timestamp - start;
      console.log("fps: ", (count * 1000) / elapsed);
      start = timestamp;
      count = 0;
    }
    if (isConnected) {
      drawPlayers();
    } else {
      gl.fillStyle = "rgb(256, 256, 256)";
      gl.fillRect(0, 0, 300, 300);
    }
    count += 1;
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
    padding: 1em 0;
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
    <canvas bind:this={canvas} width="300" height="300" />
  </div>
</main>

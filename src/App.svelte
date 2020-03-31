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

  const vsSource = `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
  `;

  const fsSource = `
    void main() {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `;

  //
  // Initialize a shader program, so WebGL knows how to draw our data
  //
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
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
    gl.clearDepth(1.0); // Clear everything
    gl.enable(gl.DEPTH_TEST); // Enable depth testing
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things

    // Clear the canvas before we start drawing on it.

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Create a perspective matrix, a special matrix that is
    // used to simulate the distortion of perspective in a camera.
    // Our field of view is 45 degrees, with a width/height
    // ratio that matches the display size of the canvas
    // and we only want to see objects between 0.1 units
    // and 100 units away from the camera.

    const fieldOfView = (45 * Math.PI) / 180; // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();

    // note: glmatrix.js always has the first argument
    // as the destination to receive the result.
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    // Set the drawing position to the "identity" point, which is
    // the center of the scene.
    const modelViewMatrix = mat4.create();

    // Now move the drawing position a bit to where we want to
    // start drawing the square.

    mat4.translate(
      modelViewMatrix, // destination matrix
      modelViewMatrix, // matrix to translate
      [-0.0, 0.0, -6.0]
    ); // amount to translate

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute.
    {
      const numComponents = 2; // pull out 2 values per iteration
      const type = gl.FLOAT; // the data in the buffer is 32bit floats
      const normalize = false; // don't normalize
      const stride = 0; // how many bytes to get from one set of values to the next
      // 0 = use type and numComponents above
      const offset = 0; // how many bytes inside the buffer to start from
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
      gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset
      );
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    }

    // Tell WebGL to use our program when drawing

    gl.useProgram(programInfo.program);

    // Set the shader uniforms

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

    {
      const offset = 0;
      const vertexCount = 4;
      gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }
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
    const buffers = initBuffers(gl);
    drawScene(gl, programInfo, buffers);

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

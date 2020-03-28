<script>
  import { onMount, onDestroy } from "svelte";
  let username;
  let x;
  let y;
  let isConnected = false;
  let interval;
  let canvas;
  let frame;
  let context = null;
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
  let graphicsStatus = "POOF!";

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
    console.log('onMount');
    gl = canvas.getContext("webgl");
    if (gl === null){
      graphicsStatus = "No webGl";
      return;
    }
    graphicsStatus = "webGl ready";
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
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

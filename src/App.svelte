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

  // $: {
  //   console.log(`x: ${x}, y: ${y}`);
  // }

  function drawPlayers() {
    if (!clonePlayers) {
      return;
    }
    context.fillStyle = "rgb(0, 0, 0)";
    context.fillRect(0, 0, 300, 300);
    for (let player of clonePlayers) {
      if (player.username == username) {
        context.fillStyle = color;
        context.fillRect(player.x - 20, 240, width, height);
        continue;
      }
      context.fillStyle = "rgb(200, 0, 0)";
      context.fillRect(player.x - 20, 20, width, height);
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
    context = canvas.getContext("2d");
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
    };
  });

  function keydown(e) {
    if (isConnected) {
      keyCode = e.keyCode;
      if (keyCode == 37) {
        //arrowleft
        x -= 3;
        if (x < 20) {
          x = 20;
        }
        return;
      }
      if (keyCode == 39) {
        //arrowright
        x += 3;
        if (x > 280) {
          x = 280;
        }
        return;
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
      context.fillStyle = "rgb(256, 256, 256)";
      context.fillRect(0, 0, 300, 300);
    }
    count += 1;
    requestAnimationFrame(loop);
  }

  onDestroy(() => {
    console.log("onDestroy");
    clearInterval(interval);
  });

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
      const res = await fetch("http://localhost:3000/players" , {
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
        }
      );
      if (res.ok){
        const json = await res.json();
        if ( !json.error ){
          console.log(json.error);
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

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
  span {
    display: block;
  }
</style>

<svelte:window on:keydown={keydown} />

<main>
  <div class="container">
    <label for="">Username:</label>
    <input type="text" bind:value={username} />
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

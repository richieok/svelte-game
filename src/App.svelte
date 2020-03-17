<script>
  import { onMount, onDestroy } from "svelte";
  export let name;
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
  let clonePlayers = [
    {
      username: "player one",
      x: 150,
      y: 0
    },
    { username: "player two", x: 150, y: 0 }
  ];

  $: userData = {
    user: username,
    position: {
      x: x,
      y: y
    }
  };

  $: {
    console.log(`x: ${x}, y: ${y}`);
  }

  $: if (isConnected) {
    interval = setInterval(() => {
      // console.log('update players position');
      for (let player of clonePlayers) {
        if (player.username == username) {
          player.x = x;
        }
      }
    }, 20);
  } else {
    console.log("cleering interval");
    clearInterval(interval);
  }

  function drawPlayers() {
    // console.log('draw');
    // getPlayers().then(players => {
    //   // console.log(players);
    //   for (let player of players) {
    //     if (player.username == username) {
    //       context.fillStyle = color;
    //       context.fillRect(player.x, 240, width, height);
    //       continue;
    //     }
    //     context.fillStyle = "rgb(200, 0, 0)";
    //     context.fillRect(player.x, 20, width, height);
    //   }
    // });

    if (!clonePlayers) {
      return;
    }
    context.fillStyle = "rgb(256, 256, 256)";
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

  async function getPlayers() {
    const res = await fetch("http://localhost:3000");
    if (res.ok) {
      let text = await res.text();
      let players = await JSON.parse(text);
      // console.log(players);
      return players;
    }
  }

  async function connect() {
    console.log(userData);
    if (!userData.user) {
      return;
    }
    let res = await fetch("http://localhost:3000", {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: JSON.stringify(userData)
    });
    if (res.ok) {
      let json = await res.json();
      // console.log(json);
      if (json.error) {
        console.log(json.error);
        return;
      }
      isConnected = true;
      console.log(json.position);
      x = json.position.x;
      y = json.position.y;
      return;
    }
    console.log(`status: ${res.status}`);
  }

  async function disconnect() {
    isConnected = false;
    username = null;
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
        if (x > 300) {
          x = 300;
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
      // console.log('elapsed: ', elapsed);
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

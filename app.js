const clientId = 'YOUR_CLIENT_ID';
const redirectUri = 'https://YOUR_USERNAME.github.io/spotify-playlist-downloader/callback.html';
const backendUrl = 'http://localhost:3000/download';
const scopes = 'playlist-read-private playlist-read-collaborative';

let accessToken = localStorage.getItem("spotify_access_token");
let cleanMode = false;

function toggleCleanMode() {
  cleanMode = !cleanMode;
  document.getElementById("cleanModeBtn").innerText = `Clean Mode: ${cleanMode ? "ON" : "OFF"}`;
}

// Extract access token if redirected
if (window.location.hash) {
  const hash = window.location.hash.substring(1).split('&').reduce((acc, cur) => {
    const [key, value] = cur.split('=');
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
  accessToken = hash.access_token;
  localStorage.setItem("spotify_access_token", accessToken);
}

// Spotify login
function login() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  window.location = authUrl;
}

// Fetch playlist and send to backend
async function getPlaylist() {
  console.log("🚨 getPlaylist CALLED");
  console.log("🔍 Access Token inside getPlaylist():", accessToken);

  if (!accessToken) {
    alert("Please login first.");
    return;
  }

  const url = document.getElementById("playlistURL").value;
  const playlistId = url.split("/playlist/")[1].split("?")[0];
  let allTracks = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const data = await res.json();
    if (data.items) {
      const tracks = data.items.map(item => {
        const track = item.track;
        return `${track.artists[0].name} - ${track.name}`;
      });
      allTracks.push(...tracks);
      if (data.items.length < limit) break;
      offset += limit;
    } else {
      console.error(data);
      break;
    }
  }

  document.getElementById("output").textContent = allTracks.join("\n");

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songs: allTracks, cleanMode }) // ✅ include cleanMode
    });

    const blob = await response.blob();
    const urlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlBlob;
    a.download = 'playlist.zip';
    a.click();
  } catch (err) {
    alert("Download failed. See console for details.");
    console.error(err);
  }
}

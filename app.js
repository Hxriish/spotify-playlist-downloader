const clientId = '8c4a9b0458fc46e2806e8daf6f3df6b5';
const redirectUri = 'https://hxriish.github.io/spotify-playlist-downloader/callback.html';
const backendUrl = 'http://localhost:3000/download';
const scopes = 'playlist-read-private playlist-read-collaborative';

let accessToken = localStorage.getItem("spotify_access_token");

// === PKCE Flow ===
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return Array.from({ length }, () => possible.charAt(Math.floor(Math.random() * possible.length))).join('');
}

function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(codeVerifier) {
  const hashed = await sha256(codeVerifier);
  return base64urlencode(hashed);
}

async function login() {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem('code_verifier', codeVerifier);

  const authUrl = `https://accounts.spotify.com/authorize?` +
    `response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge_method=S256&code_challenge=${codeChallenge}`;

  window.location = authUrl;
}

async function handleRedirect() {
  const code = new URLSearchParams(window.location.search).get('code');
  const codeVerifier = localStorage.getItem('code_verifier');

  if (!code) return;

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const data = await res.json();

    if (data.access_token) {
      accessToken = data.access_token;
      console.log("✅ Access token received:", accessToken);
      localStorage.setItem("spotify_access_token", accessToken);
      window.location.href = "index.html";
    } else {
      console.error("❌ Token exchange error:", data);
      alert("Failed to log in: " + (data.error_description || "Unknown error"));
    }
  } catch (err) {
    console.error("❌ Token fetch failed:", err);
    alert("Something went wrong during login.");
  }
}

handleRedirect();

async function getPlaylist() {
  console.log("🚨 getPlaylist CALLED");
  console.log("🔍 Access Token inside getPlaylist():", accessToken);

  if (!accessToken) {
    alert("Please login first.");
    return;
  }

  const downloadBtn = document.querySelector('button[onclick="getPlaylist()"]');
  downloadBtn.disabled = true;

  const url = document.getElementById("playlistURL").value;
  const playlistId = url.split("/playlist/")[1]?.split("?")[0];
  if (!playlistId) {
    alert("Invalid playlist URL");
    downloadBtn.disabled = false;
    return;
  }

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
      console.error("❌ Failed to fetch playlist data:", data);
      break;
    }
  }

  console.log("📤 Sending to backend:", allTracks);

  document.getElementById("output").textContent = allTracks.join("\n");

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songs: allTracks })
    });

    console.log("📦 Backend responded:", response);

    const blob = await response.blob();
    const urlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlBlob;
    a.download = 'playlist.zip';
    a.click();
  } catch (err) {
    alert("Download failed. See console for details.");
    console.error("❌ Error during fetch/post:", err);
  }

  downloadBtn.disabled = false;
  document.getElementById("playlistURL").value = "";
}

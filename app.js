// === app.js (PKCE Flow Implementation) ===

const clientId = '8c4a9b0458fc46e2806e8daf6f3df6b5';
const redirectUri = 'https://hxriish.github.io/spotify-playlist-downloader/callback.html';
const backendUrl = 'http://localhost:3000/download';
const scopes = 'playlist-read-private playlist-read-collaborative';

let accessToken = localStorage.getItem("spotify_access_token"); // ✅ Load on every page load


// Generate random string for PKCE code verifier
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
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
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

// Extract token using authorization code
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

      // Save token in localStorage so it persists after redirect
      localStorage.setItem("spotify_access_token", accessToken);

      // Redirect back to main page
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

// Call this on every page load
handleRedirect();

async function getPlaylist() {
  console.log("🚨 getPlaylist CALLED");
  console.log("🔍 Access Token inside getPlaylist():", accessToken);

  if (!accessToken) {
    alert("Please login first.");
    return;
  }

  const downloadBtn = document.querySelector('button[onclick="getPlaylist()"]');
  downloadBtn.disabled = true; // 🔒 disable the button

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
      body: JSON.stringify({ songs: allTracks })
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

  downloadBtn.disabled = false; // 🔓 re-enable after download
  document.getElementById("playlistURL").value = "";

}

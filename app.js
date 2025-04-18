const clientId = '8c4a9b0458fc46e2806e8daf6f3df6b5'
; // Replace with your real ID
const redirectUri = 'const redirectUri = 'https://hxriish.github.io/spotify-playlist-downloader/callback.html';
';
const backendUrl = 'https://your-backend-url.com/download'; // Replace with deployed backend

const scopes = 'playlist-read-private playlist-read-collaborative';
let accessToken = null;

// Redirect to Spotify login
function login() {
  const authUrl = \`https://accounts.spotify.com/authorize?client_id=\${clientId}&response_type=token&redirect_uri=\${encodeURIComponent(redirectUri)}&scope=\${encodeURIComponent(scopes)}\`;
  window.location = authUrl;
}

// Extract access token
if (window.location.hash) {
  const hash = window.location.hash.substring(1).split('&').reduce((acc, cur) => {
    const [key, value] = cur.split('=');
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
  accessToken = hash.access_token;
}

async function getPlaylist() {
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
    const res = await fetch(\`https://api.spotify.com/v1/playlists/\${playlistId}/tracks?limit=\${limit}&offset=\${offset}\`, {
      headers: {
        Authorization: \`Bearer \${accessToken}\`
      }
    });
    const data = await res.json();
    if (data.items) {
      const tracks = data.items.map(item => {
        const track = item.track;
        return \`\${track.artists[0].name} - \${track.name}\`;
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

  // Send tracks to backend for download
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
}

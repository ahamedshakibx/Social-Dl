# Video Grabber — TikTok · YouTube · Instagram · Pinterest · Facebook

একটা single-page ফ্রন্টএন্ড (`public/index.html`) + ছোট Node.js backend (`server.js`)। লিংক
পেস্ট করলে ভিডিওর সব কোয়ালিটি/ফরম্যাট দেখাবে, বাটনে ক্লিক করলে সরাসরি ব্রাউজারে ডাউনলোড হবে —
সার্ভারে কোনো ফাইল জমা থাকে না, সরাসরি স্ট্রিম হয়ে আসে।

ভেতরে সব প্ল্যাটফর্মের জন্য একই ইঞ্জিন ব্যবহার করা হয়েছে: **yt-dlp** — এটা এখন পর্যন্ত সবচেয়ে
বেশি maintained ও ভরসাযোগ্য ওপেন-সোর্স ভিডিও এক্সট্র্যাক্টর, ১৮০০+ সাইট সাপোর্ট করে (এই ৫টা
প্ল্যাটফর্মসহ)। প্রথমে দেওয়া ৫টা আলাদা repo আলাদা আলাদা টুল দিয়ে বানানো (Node/CoffeeScript,
Flask+pytube, FastAPI+yt-dlp...) — সবগুলো এক প্রজেক্টে জোড়া লাগানোর চেয়ে একটা ভরসাযোগ্য
ইঞ্জিনে সবকিছু চালানো অনেক বেশি স্টেবল।

## ইনস্টল করার ধাপ

### ১. Node.js (v18+)
```
node -v   # না থাকলে https://nodejs.org থেকে ইনস্টল করো
```

### ২. yt-dlp (এটাই আসল কাজটা করে)
```
# macOS
brew install yt-dlp ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod +x /usr/local/bin/yt-dlp

# Windows
# https://github.com/yt-dlp/yt-dlp/releases থেকে yt-dlp.exe নামাও,
# একটা folder-এ রেখে সেই folder PATH-এ যোগ করো।
# ffmpeg: https://ffmpeg.org/download.html
```
চেক করো: `yt-dlp --version`

yt-dlp যদি PATH-এ না থাকে, `server.js` চালানোর সময় এনভায়রনমেন্ট ভ্যারিয়েবল দাও:
```
YT_DLP_PATH=/full/path/to/yt-dlp npm start
```

### ৩. প্রজেক্ট ডিপেন্ডেন্সি ইনস্টল
```
npm install
```

### ৪. সার্ভার চালু করো
```
npm start
```
তারপর ব্রাউজারে যাও: **http://localhost:3000**

## কীভাবে কাজ করে
- `POST /api/info` — লিংক থেকে টাইটেল, থাম্বনেইল, আর সব ফরম্যাট/কোয়ালিটির লিস্ট আনে (`yt-dlp -j`)
- `GET /api/download` — বাছাই করা ফরম্যাট সরাসরি ব্রাউজারে স্ট্রিম করে পাঠায় (`yt-dlp -o -`)
- `GET /api/health` — yt-dlp ইনস্টল আছে কিনা চেক করে; না থাকলে ফ্রন্টএন্ডে একটা সতর্কবার্তা দেখায়

## মনে রাখার বিষয়
- শুধু **public/দেখা যায় এমন** ভিডিওর জন্য কাজ করবে — প্রাইভেট বা লগইন-ওয়াল থাকা কনটেন্টের জন্য না।
- TikTok/YouTube/Instagram/Pinterest/Facebook — প্রতিটার নিজস্ব Terms of Service আছে যেখানে
  সাধারণত ডাউনলোডিং সীমিত করা থাকে। এটা ব্যক্তিগত/অফলাইন ব্যবহারের জন্য — অন্য কারো কনটেন্ট তার
  অনুমতি ছাড়া অন্য কোথাও রি-আপলোড/পাবলিশ কোরো না।
- yt-dlp মাঝেমধ্যে আপডেট দরকার হয় (প্ল্যাটফর্মগুলো নিজেদের সিস্টেম বদলালে): `yt-dlp -U`
- এটা localhost-এর জন্য বানানো ছোট টুল। ইন্টারনেটে পাবলিকলি hosted করতে চাইলে rate-limiting ও
  input-validation আরও শক্ত করা উচিত।

## ডিপ্লয় করা — Render (backend) + InfinityFree (frontend)

**InfinityFree-তে `server.js` কাজ করবে না** — ওটা শুধু static HTML/PHP hosting, Node.js বা
কোনো বাইনারি (yt-dlp) রান করতে পারে না। এই backend-এর জন্য Render.com ব্যবহার করো (free, Docker
সাপোর্ট করে, তাই yt-dlp+ffmpeg ইনস্টল করা যায়)। `Dockerfile` আগে থেকেই রেডি আছে।

### ধাপ ১ — Backend Render-এ deploy করো
1. এই পুরো folder-টা GitHub-এ একটা repo হিসেবে push করো
2. [render.com](https://render.com) এ সাইন আপ করো (কার্ড লাগবে না)
3. **New → Web Service** → তোমার repo সিলেক্ট করো
4. Render নিজে থেকেই `Dockerfile` ধরে ফেলবে — Environment: **Docker** রেখে **Create Web Service**
5. ২-৫ মিনিট পর একটা URL পাবে, যেমন: `https://tomar-app-name.onrender.com`
   (মনে রেখো: free tier ১৫ মিনিট নিষ্ক্রিয় থাকলে ঘুমিয়ে যায়, পরের request-এ ৩০-৬০ সেকেন্ড লাগে জেগে উঠতে)

### ধাপ ২ — Frontend InfinityFree-তে আপলোড করো
1. `public/index.html` ফাইলটা খোলো, ওপরের দিকে এই লাইনটা বদলাও:
   ```js
   const API_BASE = "https://tomar-app-name.onrender.com";
   ```
   (ধাপ ১-এ পাওয়া তোমার আসল Render URL বসাও)
2. এই একটা ফাইল (`index.html`) InfinityFree-র `htdocs/` ফোল্ডারে আপলোড করো (File Manager বা FTP দিয়ে)
3. ব্যস — তোমার InfinityFree ডোমেইন থেকেই সাইট চলবে, সব ভারী কাজ (yt-dlp) হবে Render-এ

এভাবে backend আর frontend দুই জায়গায় থাকলেও ইউজারের কাছে এটা এক সাইট — আর frontend-টা সত্যিই
একটা মাত্র self-contained HTML ফাইল (এর ভেতরেই সব CSS/JS আছে, আলাদা কিছু লাগে না)।

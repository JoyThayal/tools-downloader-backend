FROM node:20-slim

# পাইথন (python-is-python3 সহ), curl এবং ffmpeg ইনস্টল করা
RUN apt-get update && apt-get install -y python3 python-is-python3 curl ffmpeg && rm -rf /var/lib/apt/lists/*

# লিনাক্স yt-dlp ইনস্টল করা
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./

# স্ক্রিপ্ট ইগনোর করে ক্লিন ইনস্টল
RUN npm install --omit=dev --ignore-scripts

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
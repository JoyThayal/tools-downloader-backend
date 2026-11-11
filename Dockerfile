FROM node:20-slim

# পাইথন এবং ffmpeg ইনস্টল করা
RUN apt-get update && apt-get install -y python3 curl ffmpeg && rm -rf /var/lib/apt/lists/*

# অফিশিয়াল লিনাক্স yt-dlp ইনস্টল করা
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
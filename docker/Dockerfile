FROM debian:stable AS resource

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y wget xz-utils dos2unix \
    && wget https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-$(dpkg --print-architecture)-static.tar.xz \
    && mkdir -p /res/ffmpeg \
    && tar -xvf ./ffmpeg-git-$(dpkg --print-architecture)-static.tar.xz -C /res/ffmpeg --strip-components 1
    
COPY docker-entrypoint.sh /res/entrypoint.sh

RUN dos2unix /res/entrypoint.sh \
    && chmod +x /res/entrypoint.sh


FROM node:lts-slim AS runtime

COPY --from=resource /res/ffmpeg/ffmpeg /usr/bin/ffmpeg

COPY --from=resource /res/ffmpeg/ffprobe /usr/bin/ffprobe

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y curl wget gnupg git python3-pip fonts-wqy-microhei xfonts-utils chromium fontconfig libxss1 libgl1 \
    && apt-get autoremove \
    && apt-get clean

RUN fc-cache -f -v

RUN git config --global --add safe.directory '*' \
    && git config --global pull.rebase false \
    && git config --global user.email "Yunzai@yunzai.bot" \
    && git config --global user.name "Yunzai"

RUN npm install pnpm -g

RUN ln -s /usr/bin/python3 /usr/bin/python \
    && curl -fsSL https://install.python-poetry.org | python - \
    && ln -s /$HOME/.local/bin/poetry /usr/bin \
    && poetry config virtualenvs.in-project true

RUN rm -rf /var/cache/* \
    && rm -rf /tmp/*


FROM runtime AS prod

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN git clone --depth=1 --branch main https://gitee.com/Le-niao/Yunzai-Bot.git /app/Yunzai-Bot\
    && cd /app/Yunzai-Bot \
    && sed -i 's/127.0.0.1/redis/g' ./config/default_config/redis.yaml \
    && pnpm install -P

COPY --from=resource /res/entrypoint.sh /app/Yunzai-Bot/entrypoint.sh

WORKDIR /app/Yunzai-Bot

ENTRYPOINT ["/app/Yunzai-Bot/entrypoint.sh"]

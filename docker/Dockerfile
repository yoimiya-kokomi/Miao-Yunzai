FROM debian:stable AS resource

RUN sed -i "s/deb.debian.org/mirrors.ustc.edu.cn/g" /etc/apt/sources.list \
    && apt-get update \
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

RUN sed -i "s/deb.debian.org/mirrors.ustc.edu.cn/g" /etc/apt/sources.list \
    && apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y curl wget gnupg git python3-pip python3-venv fonts-wqy-microhei xfonts-utils chromium fontconfig libxss1 libgl1 \
    && apt-get autoremove \
    && apt-get clean

RUN fc-cache -f -v

RUN git config --global --add safe.directory '*' \
    && git config --global pull.rebase false \
    && git config --global user.email "Yunzai@yunzai.bot" \
    && git config --global user.name "Yunzai"

RUN npm install pnpm -g

RUN ln -s /usr/bin/python3 /usr/bin/python \
    && POETRY_HOME=$HOME/venv-poetry \
    && python -m venv $POETRY_HOME \
    && $POETRY_HOME/bin/pip install --upgrade pip setuptools -i https://pypi.tuna.tsinghua.edu.cn/simple \
    && $POETRY_HOME/bin/pip install poetry -i https://pypi.tuna.tsinghua.edu.cn/simple \
    && ln -s $POETRY_HOME/bin/poetry /usr/bin \
    && poetry config virtualenvs.in-project true

RUN rm -rf /var/cache/* \
    && rm -rf /tmp/*


FROM runtime AS prod

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN git clone --depth=1 --branch master https://gitee.com/yoimiya-kokomi/Miao-Yunzai.git /app/Miao-Yunzai\
    && cd /app/Miao-Yunzai \
    && sed -i 's/127.0.0.1/redis/g' ./config/default_config/redis.yaml \
    && pnpm install -P

COPY --from=resource /res/entrypoint.sh /app/Miao-Yunzai/entrypoint.sh

WORKDIR /app/Miao-Yunzai

ENTRYPOINT ["/app/Miao-Yunzai/entrypoint.sh"]

#TRSS Yunzai Docker 安装脚本 作者：时雨🌌星空
NAME=v1.0.0 VERSION=202508290
R="[1;31m" G="[1;32m" Y="[1;33m" C="[1;36m" B="[1;m" O="[m"
echo "$B———————————————————————————
$R TRSS$Y Yunzai$G Docker$C Script$O
    $G$NAME$C ($VERSION)$O
$B———————————————————————————
     $G作者：$C时雨🌌星空$O

$Y- 正在检查环境$O
"
DIR="${DIR:-$HOME/Yunzai}"
CMD="${CMD:-tsyz}"
CMDPATH="${CMDPATH:-/usr/local/bin}"
DKNAME="${DKNAME:-Yunzai}"
DKURL="${DKURL:-docker.m.daocloud.io}"
GITURL="${GITURL:-https://gitee.com/TimeRainStarSky/Yunzai}"
APTURL="${APTURL:-mirrors.ustc.edu.cn}"
APTDEP="${APTDEP:-chromium fonts-lxgw-wenkai fonts-noto-color-emoji}"
NPMURL="${NPMURL:-https://registry.npmmirror.com}"
abort(){ echo "
$R! $@$O";exit 1;}
mktmp(){ TMP="$DIR/tmp"&&rm -rf "$TMP"&&mkdir -p "$TMP"||abort "缓存目录创建失败";}
if type docker;then
  echo "
$G- Docker 已安装$O
"
elif type pacman &>/dev/null;then
  echo "
$Y- 正在使用 pacman 安装 Docker$O
"
  pacman -Syu --noconfirm --needed --overwrite "*" docker||abort "Docker 安装失败"
elif type apt &>/dev/null;then
  echo "
$Y- 正在使用 apt 安装 Docker$O
"
  apt update&&apt install -y docker.io||abort "Docker 安装失败"
else
  echo "
$Y- 正在使用 官方脚本 安装 Docker$O
"
  DOWNLOAD_URL="https://$APTURL/docker-ce" bash <(curl -L get.docker.com)||abort "官方脚本 执行失败，请自行安装 Docker 后重试：https://docker.com"
fi
docker info||{ systemctl enable --now docker||service docker start&&docker info;}&&echo "
$G- Docker 已启动$O"||abort "Docker 启动失败"
N=1
until echo "
$Y- 正在从 $C$DKURL$Y 下载 Docker 容器$O
"
docker pull "$DKURL/library/node:slim";do
  echo "
$R! 下载失败，5秒后切换镜像源$O"
  sleep 5
  ((N++))
  case "$N" in
    1)DKURL="docker.m.daocloud.io";;
    2)DKURL="mirror.ccs.tencentyun.com";;
    3)DKURL="docker.1ms.run";;
    4)DKURL="docker.xuanyuan.me";;
    5)DKURL="docker.mybacc.com";;
    6)DKURL="dytt.online";;
    7)DKURL="lispy.org";;
    8)DKURL="docker.escateam.icu";;
    9)DKURL="docker.escaped.icu";;
    *)DKURL="docker.io";N=0
  esac
done
echo "
$Y- 正在构建 Docker 容器$O
"
mktmp
cd "$TMP"
echo "FROM $DKURL"'/library/node:trixie-slim
RUN sed -i "s|deb.debian.org|'"$APTURL"'|g" /etc/apt/sources.list.d/debian.sources\
 && apt update\
 && apt install -y ca-certificates\
 && sed -i "s|http://'"$APTURL"'|https://'"$APTURL"'|" /etc/apt/sources.list.d/debian.sources\
 && apt update\
 && apt full-upgrade -y\
 && apt install -y curl git valkey-server '"$APTDEP"'\
 && apt autoremove --purge\
 && apt clean\
 && ln -vsf valkey-server /bin/redis-server\
 && git config --global --add safe.directory "*"\
 && npm install -g pnpm --registry "'"$NPMURL"'"\
 && rm -rf /var/cache/* /var/log/* /var/lib/apt /root/.npm\
 && echo -n "[ -s .git ]||git clone --depth 1 --single-branch \"'"$GITURL"'\" .&&pnpm install --force&&echo -n \"exec node . start\">/start&&exec sh /start">/start
HEALTHCHECK CMD curl -s http://localhost:2536/status||exit 1
WORKDIR /root/Yunzai
ENTRYPOINT []
CMD ["sh","/start"]
EXPOSE 2536'>Dockerfile
docker build -t trss:yunzai .||abort "Docker 容器构建失败"
echo "
$Y- 正在启动 Docker 容器$O
"
docker rm -f $DKNAME 2>/dev/null
docker image prune -f
docker run -itd -h Yunzai --name $DKNAME -v "$DIR":/root/Yunzai --restart always $([ $DKNAME = Yunzai ]&&echo "-p2536:2536"||echo "-P") trss:yunzai||abort "Docker 容器启动失败"
mkdir -vp "$CMDPATH"&&
echo -n 'if [ -n "$1" ];then case "$1" in
  s|start)exec docker start '$DKNAME';;
  st|stop)exec docker stop '$DKNAME';;
  rs|restart)exec docker restart '$DKNAME';;
  l|log)exec docker logs -fn"${2:-100}" '$DKNAME';;
  *)exec docker exec -it '$DKNAME' "$@";;
esac;else
  docker logs -n100 '$DKNAME'
  exec docker attach '$DKNAME'
fi'>"$CMDPATH/$CMD"&&
chmod 755 "$CMDPATH/$CMD"||abort "脚本执行命令 $CMDPATH/$CMD 设置失败，手动执行命令：docker attach $DKNAME"
echo "
$G- Docker 容器安装完成，启动命令：$C$CMD$O"
rm -rf "$TMP"
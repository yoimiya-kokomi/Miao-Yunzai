#!/usr/bin/env bash

set +e

GreenBG="\\033[42;37m"
YellowBG="\\033[43;37m"
BlueBG="\\033[44;37m"
Font="\\033[0m"

Version="${BlueBG}[版本]${Font}"
Info="${GreenBG}[信息]${Font}"
Warn="${YellowBG}[提示]${Font}"

WORK_DIR="/app/Miao-Yunzai"
MIAO_PLUGIN_PATH="/app/Miao-Yunzai/plugins/miao-plugin"
XIAOYAO_CVS_PATH="/app/Miao-Yunzai/plugins/xiaoyao-cvs-plugin"
PY_PLUGIN_PATH="/app/Miao-Yunzai/plugins/py-plugin"

if [[ ! -d "$HOME/.ovo" ]]; then
    mkdir ~/.ovo
fi

echo -e "\n ================ \n ${Info} ${GreenBG} 拉取 Miao-Yunzai 更新 ${Font} \n ================ \n"

cd $WORK_DIR

if [[ -z $(git status -s) ]]; then
    echo -e " ${Warn} ${YellowBG} 当前工作区有修改，尝试暂存后更新。${Font}"
    git add .
    git stash
    git pull origin master --allow-unrelated-histories --rebase
    git stash pop
else
    git pull origin master --allow-unrelated-histories
fi

if [[ ! -f "$HOME/.ovo/yunzai.ok" ]]; then
    set -e
    echo -e "\n ================ \n ${Info} ${GreenBG} 更新 Miao-Yunzai 运行依赖 ${Font} \n ================ \n"
    pnpm install -P
    touch ~/.ovo/yunzai.ok
    set +e
fi

echo -e "\n ================ \n ${Version} ${BlueBG} Miao-Yunzai 版本信息 ${Font} \n ================ \n"

git log -1 --pretty=format:"%h - %an, %ar (%cd) : %s"

if [ ! -d $MIAO_PLUGIN_PATH"/.git" ]; then
    echo -e "\n ${Warn} ${YellowBG} 由于喵版云崽依赖miao-plugin，检测到目前没有安装，开始自动下载 ${Font} \n"
    git clone --depth=1 https://gitee.com/yoimiya-kokomi/miao-plugin.git ./plugins/miao-plugin/
fi


if [ -d $MIAO_PLUGIN_PATH"/.git" ]; then

    echo -e "\n ================ \n ${Info} ${GreenBG} 拉取 喵喵插件 更新 ${Font} \n ================ \n"

    cd $MIAO_PLUGIN_PATH

    if [[ -n $(git status -s) ]]; then
        echo -e " ${Warn} ${YellowBG} 当前工作区有修改，尝试暂存后更新。${Font}"
        git add .
        git stash
        git pull origin master --allow-unrelated-histories --rebase
        git stash pop
    else
        git pull origin master --allow-unrelated-histories
    fi

    if [[ ! -f "$HOME/.ovo/miao.ok" ]]; then
        set -e
        echo -e "\n ================ \n ${Info} ${GreenBG} 更新 喵喵插件 运行依赖 ${Font} \n ================ \n"
        pnpm install -P
        touch ~/.ovo/miao.ok
        set +e
    fi

    echo -e "\n ================ \n ${Version} ${BlueBG} 喵喵插件版本信息 ${Font} \n ================ \n"
    git log -1 --pretty=format:"%h - %an, %ar (%cd) : %s"

fi

if [ -d $PY_PLUGIN_PATH"/.git" ]; then

    echo -e "\n ================ \n ${Info} ${GreenBG} 拉取 py-plugin 插件更新 ${Font} \n ================ \n"

    cd $PY_PLUGIN_PATH

    if [[ -n $(git status -s) ]]; then
        echo -e " ${Warn} ${YellowBG} 当前工作区有修改，尝试暂存后更新。${Font}"
        git add .
        git stash
        git pull origin v3 --allow-unrelated-histories --rebase
        git stash pop
    else
        git pull origin v3 --allow-unrelated-histories
    fi

    if [[ ! -f "$HOME/.ovo/py.ok" ]]; then
        set -e
        echo -e "\n ================ \n ${Info} ${GreenBG} 更新 py-plugin 运行依赖 ${Font} \n ================ \n"
        pnpm install iconv-lite @grpc/grpc-js @grpc/proto-loader -w
        poetry config virtualenvs.in-project true
        poetry install
        touch ~/.ovo/py.ok
        set +e
    fi

    echo -e "\n ================ \n ${Version} ${BlueBG} py-plugin 插件版本信息 ${Font} \n ================ \n"

    git log -1 --pretty=format:"%h - %an, %ar (%cd) : %s"

fi

if [ -d $XIAOYAO_CVS_PATH"/.git" ]; then

    echo -e "\n ================ \n ${Info} ${GreenBG} 拉取 xiaoyao-cvs 插件更新 ${Font} \n ================ \n"

    cd $XIAOYAO_CVS_PATH

    if [[ -n $(git status -s) ]]; then
        echo -e " ${Warn} ${YellowBG} 当前工作区有修改，尝试暂存后更新。${Font}"
        git add .
        git stash
        git pull origin master --allow-unrelated-histories --rebase
        git stash pop
    else
        git pull origin master --allow-unrelated-histories
    fi

    if [[ ! -f "$HOME/.ovo/xiaoyao.ok" ]]; then
        set -e
        echo -e "\n ================ \n ${Info} ${GreenBG} 更新 xiaoyao-cvs 插件运行依赖 ${Font} \n ================ \n"
        pnpm add promise-retry superagent -w
        touch ~/.ovo/xiaoyao.ok
        set +e
    fi

    echo -e "\n ================ \n ${Version} ${BlueBG} xiaoyao-cvs 插件版本信息 ${Font} \n ================ \n"

    git log -1 --pretty=format:"%h - %an, %ar (%cd) : %s"
fi

if [ -d $GUOBA_PLUGIN_PATH"/.git" ]; then

    echo -e "\n ================ \n ${Info} ${GreenBG} 拉取 Guoba-Plugin 插件更新 ${Font} \n ================ \n"

    cd $GUOBA_PLUGIN_PATH

    if [[ -n $(git status -s) ]]; then
        echo -e " ${Warn} ${YellowBG} 当前工作区有修改，尝试暂存后更新。${Font}"
        git add .
        git stash
        git pull origin master --allow-unrelated-histories --rebase
        git stash pop
    else
        git pull origin master --allow-unrelated-histories
    fi

    if [[ ! -f "$HOME/.ovo/guoba.ok" ]]; then
        set -e
        echo -e "\n ================ \n ${Info} ${GreenBG} 更新 Guoba-Plugin 插件运行依赖 ${Font} \n ================ \n"
        pnpm add multer body-parser jsonwebtoken -w
        touch ~/.ovo/guoba.ok
        set +e
    fi

    echo -e "\n ================ \n ${Version} ${BlueBG} Guoba-Plugin 插件版本信息 ${Font} \n ================ \n"

    git log -1 --pretty=format:"%h - %an, %ar (%cd) : %s"
fi

set -e

cd $WORK_DIR

echo -e "\n ================ \n ${Info} ${GreenBG} 初始化 Docker 环境 ${Font} \n ================ \n"

if [ -f "./config/config/redis.yaml" ]; then
    sed -i 's/127.0.0.1/redis/g' ./config/config/redis.yaml
    echo -e "\n  修改Redis地址完成~  \n"
fi

echo -e "\n ================ \n ${Info} ${GreenBG} 启动 Miao-Yunzai ${Font} \n ================ \n"

set +e
node app
EXIT_CODE=$?

if [[ $EXIT_CODE != 0 ]]; then
	echo -e "\n ================ \n ${Warn} ${YellowBG} 启动 Miao-Yunzai 失败 ${Font} \n ================ \n"
	tail -f /dev/null
fi

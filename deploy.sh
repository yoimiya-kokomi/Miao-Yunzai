#!/usr/bin/env sh

# 确保脚本抛出遇到的错误
set -e

# 生成静态文件

npm run docs

# 进入生成的文件夹

cd docs/

git init
git add -A
git commit -m 'add'

git push -f git@github.com:yoimiya-kokomi/Miao-Yunzai.git master:docs

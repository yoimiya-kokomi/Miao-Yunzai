# 3.1.0

* 支持协议端：GSUIDCore、微信
* 重构CK与UID管理逻辑
    * 支持多UID绑定，可绑定多个UID并进行切换
    * 支持原神与星铁UID共存，可针对查询命令分配对应UID
    * 新增`#删除uid1`命令，可对`#uid`列表内的绑定UID进行删除
    * 使用sqlite进行ck与uid存储
* 底层对星铁查询进行支持 **@cvs**

# 3.0.2

* 支持协议端：ComWeChat、ICQQ、QQ频道、KOOK、Telegram、Discord
* 3.6卡池以及图像武器别名等数据更新 **@cvs**
* 将渲染逻辑独立，支持扩展渲染器 **@ikuaki**

# 3.0.1

* 支持多账号，支持协议端：go-cqhttp
* 由于完全删除了 OICQ，并且内置 `segment`，若插件缺少 OICQ，需删除 `import { segment } from "oicq"`

# 3.0.0

* 从 Miao-Yunzai 分支

# 3.0.0
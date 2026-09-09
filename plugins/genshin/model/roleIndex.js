import base from "./base.js"
import MysInfo from "./mys/mysInfo.js"
import gsCfg from "./gsCfg.js"
import lodash from "lodash"
import moment from "moment"
import fs from "node:fs"
import { Character } from "#miao.models"

let dsz = "待实装"
let imgFile = {}

export default class RoleIndex extends base {
  constructor(e) {
    super(e)
    this.model = "roleIndex"
    this.other = gsCfg.getdefSet("role", "other")
    this.wother = gsCfg.getdefSet("weapon", "other")
    this.lable = gsCfg.getdefSet("role", "index")

    this.area = {
      蒙德: 1,
      璃月: 2,
      雪山: 3,
      稻妻: 4,
      渊下宫: 5,
      层岩巨渊: 6,
      层岩地下: 7,
      须弥: 8,
      枫丹: 9,
      沉玉谷: 10,
      来歆山: 11,
      沉玉谷·南陵: 12,
      沉玉谷·上谷: 13,
      旧日之海: 14,
      纳塔: 15,
      远古圣山: 16,
      挪德卡莱: 17,
      风息山: 18,
      空之神殿: 19,
      至冬: 20,
    }

    this.all_chest = 0
    lodash.forEach(this.lable, (v, i) => {
      if (i.includes("_chest")) this.all_chest += v
    })

    this.areaName = lodash.invert(this.area)

    this.headIndexStyle = `<style> .head_box { background: url(${this.screenData.pluResPath}img/roleIndex/namecard/${lodash.random(1, 8)}.png) #f5f5f5; background-position-x: 30px; background-repeat: no-repeat; border-radius: 15px; font-family: tttgbnumber; padding: 10px 20px; position: relative; background-size: auto 101%; }</style>`
  }

  async roleCard() {
    this.model = "roleCard"
    let res = await MysInfo.get(this.e, "index")

    if (!res || res.retcode !== 0) return false

    return this.roleCardData(res.data)
  }

  roleCardData(res) {
    let stats = res.stats
    let line = [
      [
        { lable: "活跃天数", num: stats.active_day_number },
        { lable: "成就", num: stats.achievement_number },
        { lable: "角色数", num: stats.avatar_number },
        { lable: "等级", num: res?.role?.level ?? 0 },
        {
          lable: "总宝箱",
          num:
            stats.precious_chest_number +
            stats.luxurious_chest_number +
            stats.exquisite_chest_number +
            stats.common_chest_number +
            stats.magic_chest_number,
        },
      ],
      [
        { lable: "华丽宝箱", num: stats.luxurious_chest_number },
        { lable: "珍贵宝箱", num: stats.precious_chest_number },
        { lable: "精致宝箱", num: stats.exquisite_chest_number },
        { lable: "普通宝箱", num: stats.common_chest_number },
        { lable: "奇馈宝箱", num: stats.magic_chest_number },
        { lable: "传送点", num: stats.way_point_number },
      ],
    ]

    let explor1 = []
    let explor2 = []

    res.world_explorations = lodash.orderBy(res.world_explorations, ["id"], ["desc"])

    for (let val of res.world_explorations) {
      val.name = this.areaName[val.id]
        ? this.areaName[val.id]
        : lodash.truncate(val.name, { length: 6 })

      let tmp = { lable: val.name, num: `${val.exploration_percentage / 10}%` }

      if (explor1.length < 5) {
        explor1.push(tmp)
      } else {
        explor2.push(tmp)
      }
    }

    explor2 = explor2.concat([
      { lable: "冰神瞳", num: stats.iceculus_number },
      { lable: "月神瞳", num: stats.moonoculus_number },
      { lable: "火神瞳", num: stats.pyroculus_number },
      { lable: "水神瞳", num: stats.hydroculus_number },
      { lable: "草神瞳", num: stats.dendroculus_number },
      { lable: "雷神瞳", num: stats.electroculus_number },
      { lable: "岩神瞳", num: stats.geoculus_number },
      { lable: "风神瞳", num: stats.anemoculus_number },
      { lable: "秘境", num: stats.domain_number },
    ])

    line.push(explor1)
    line.push(explor2.slice(0, 5))

    let avatars = res.avatars
    avatars = avatars.slice(0, 8)

    let element = gsCfg.getdefSet("element", "role")
    for (let i in avatars) {
      if (avatars[i].id == 10000005) {
        avatars[i].name = "空"
      }
      if (avatars[i].id == 10000007) {
        avatars[i].name = "荧"
      }
      avatars[i].element = element[avatars[i].name]
      let char = Character.get(avatars[i].name)
      avatars[i].img = char.imgs?.gacha
    }

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      name: (this.e.sender.card || this.e.sender.nickname || "").replace(this.e.uid, "").trim(),
      user_id: this.e.user_id,
      line,
      avatars,
      bg: lodash.random(1, 3),
      ...this.screenData,
    }
  }

  async roleExplore() {
    this.model = "roleExplore"
    let ApiData = {
      index: "",
      basicInfo: "",
    }
    let res = await MysInfo.get(this.e, ApiData)

    if (!res || res[0].retcode !== 0) return false

    let ret = []
    res.forEach(v => ret.push(v.data))

    return this.roleExploreData(ret)
  }

  async roleExploreData(res) {
    let [resIndex, basicInfo] = res

    let stats = resIndex.stats
    let percentage = lodash.round(
      ((stats.precious_chest_number +
        stats.luxurious_chest_number +
        stats.exquisite_chest_number +
        stats.common_chest_number +
        stats.magic_chest_number) *
        100) /
        this.all_chest,
      2,
    )

    let afterPercentage =
      percentage < 60
        ? "D"
        : (percentage < 70 ? "C" : percentage < 80 ? "B" : percentage < 90 ? "A" : "S") +
          `[${percentage}%]`

    let daysDifference =
      Math.floor((new Date() - new Date("2020-09-15")) / (1000 * 60 * 60 * 24)) + 1

    let line = [
      [
        { lable: "活跃天数", num: stats.active_day_number, extra: `${daysDifference}` },
        { lable: "深境螺旋", num: stats.spiral_abyss },
        {
          lable: "幻想真境剧诗",
          num: !stats.role_combat.is_unlock
            ? "未解锁"
            : !stats.role_combat.has_detail_data
              ? "-"
              : `第${stats.role_combat.max_round_id}幕${stats.role_combat.tarot_finished_cnt > 0 ? ` 圣牌${stats.role_combat.tarot_finished_cnt}` : ""}`,
        },
        {
          lable: "幽境危战",
          num: !stats.hard_challenge.is_unlock
            ? "未解锁"
            : !stats.hard_challenge.has_data
              ? "-"
              : ["I", "II", "III", "IV", "V", "VI"][stats.hard_challenge.difficulty - 1],
        },
      ],
      [
        { lable: "角色数", num: stats.avatar_number, extra: this.lable.avatar },
        // 默认奇偶男性女性都拿了
        { lable: "满好感角色", num: stats.full_fetter_avatar_num, extra: stats.avatar_number - 3 },
        { lable: "传送点", num: stats.way_point_number, extra: this.lable.way_point },
        { lable: "秘境", num: stats.domain_number, extra: this.lable.domain },
        { lable: "成就", num: stats.achievement_number, extra: this.lable.achievement },
      ],
      [
        {
          lable: "宝箱总数",
          num:
            stats.precious_chest_number +
            stats.luxurious_chest_number +
            stats.exquisite_chest_number +
            stats.common_chest_number +
            stats.magic_chest_number,
          extra: this.all_chest,
        },
        {
          lable: "宝箱获取率",
          num: afterPercentage,
          color:
            afterPercentage.substr(0, 1) == "D"
              ? "#12a182"
              : afterPercentage.substr(0, 1) == "C"
                ? "#2775b6"
                : afterPercentage.substr(0, 1) == "B"
                  ? "#806d9e"
                  : afterPercentage.substr(0, 1) == "A"
                    ? "#c04851"
                    : afterPercentage.substr(0, 1) == "S"
                      ? "#f86b1d"
                      : "",
        },
        { lable: "普通宝箱", num: stats.common_chest_number, extra: this.lable.common_chest },
        { lable: "精致宝箱", num: stats.exquisite_chest_number, extra: this.lable.exquisite_chest },
        { lable: "珍贵宝箱", num: stats.precious_chest_number, extra: this.lable.precious_chest },
      ],
      [
        { lable: "华丽宝箱", num: stats.luxurious_chest_number, extra: this.lable.luxurious_chest },
        { lable: "奇馈宝箱", num: stats.magic_chest_number, extra: this.lable.magic_chest },
        { lable: "风神瞳", num: stats.anemoculus_number, extra: this.lable.anemoculus },
        { lable: "岩神瞳", num: stats.geoculus_number, extra: this.lable.geoculus },
        { lable: "雷神瞳", num: stats.electroculus_number, extra: this.lable.electroculus },
      ],
      [
        { lable: "草神瞳", num: stats.dendroculus_number, extra: this.lable.dendroculus },
        { lable: "水神瞳", num: stats.hydroculus_number, extra: this.lable.hydroculus },
        { lable: "火神瞳", num: stats.pyroculus_number, extra: this.lable.pyroculus },
        { lable: "月神瞳", num: stats.moonoculus_number, extra: this.lable.moonoculus },
        { lable: "冰神瞳", num: stats.iceculus_number, extra: this.lable.iceculus },
      ],
    ]
    // 尘歌壶
    if (resIndex.homes && resIndex.homes.length > 0) {
      line.push([
        { lable: "家园等级", num: resIndex.homes[0].level },
        { lable: "最高仙力", num: resIndex.homes[0].comfort_num },
        { lable: "洞天名称", num: resIndex.homes[0].comfort_level_name },
        { lable: "获得摆设", num: resIndex.homes[0].item_num },
        { lable: "历史访客", num: resIndex.homes[0].visit_num },
      ])
    }

    resIndex.world_explorations = lodash.orderBy(resIndex.world_explorations, ["id"], ["desc"])

    let explor = []
    for (let val of resIndex.world_explorations) {
      if ([7, 11, 12, 13].includes(val.id)) continue

      val.name = this.areaName[val.id]
        ? this.areaName[val.id]
        : lodash.truncate(val.name, { length: 6 })

      let tmp = {
        name: val.name,
        line: [
          {
            name: val.name,
            text: `${val.exploration_percentage / 10}%`,
          },
        ],
      }

      if (val.id == 10) tmp.line = []

      if (["蒙德", "璃月", "稻妻", "须弥", "枫丹"].includes(val.name)) {
        tmp.line.push({ name: "声望", text: `${val.level}级` })
      }

      if ([6, 10].includes(val.id)) {
        let oidArr = [7]
        if (val.id == 10) oidArr = [13, 12, 11]
        for (let oid of oidArr) {
          let underground = lodash.find(resIndex.world_explorations, function (o) {
            return o.id == oid
          })
          if (underground) {
            tmp.line.push({
              name: this.areaName[underground.id],
              text: `${underground.exploration_percentage / 10}%`,
            })
          }
        }
      }

      if (
        ["雪山", "稻妻", "层岩巨渊", "须弥", "枫丹", "沉玉谷", "纳塔", "空之神殿"].includes(
          val.name,
        )
      ) {
        if (val.offerings[0].name.includes("流明石")) {
          val.offerings[0].name = "流明石"
        }
        if (val.offerings[0].name.includes("摹忆中枢")) {
          val.offerings[0].name = "摹忆中枢"
        }

        tmp.line.push({
          name: val.offerings[0].name,
          text: `${val.offerings[0].level}级`,
        })
      }

      explor.push(tmp)
    }

    let avatar = ""
    if (this.e.member?.getAvatarUrl) {
      avatar = await this.e.member.getAvatarUrl()
    } else if (this.e.friend?.getAvatarUrl) {
      avatar = await this.e.friend.getAvatarUrl()
    } else {
      avatar = resIndex.role.game_head_icon
    }

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      activeDay: this.dayCount(stats.active_day_number),
      line,
      explor,
      basicInfo,
      headIndexStyle: this.headIndexStyle,
      ...this.screenData,
      gamename: resIndex?.role?.nickname ?? 0,
      avatar,
      gameavatar: resIndex?.role?.avatar ?? 0,
      gamelevel: resIndex?.role?.level ?? 0,
      gamefwq: resIndex?.role?.region,
    }
  }

  dayCount(num) {
    let daysDifference =
      Math.floor((new Date() - new Date("2020-09-15")) / (1000 * 60 * 60 * 24)) + 1
    let days = Math.floor(num)
    let msg = "活跃天数：" + days + `/${daysDifference}天`
    return msg
  }
}

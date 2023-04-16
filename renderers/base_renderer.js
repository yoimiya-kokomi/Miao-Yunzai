export default class BaseRenderer {
  /**
   * 截图
   */
  async screenshot(name, data = {}) {
    this.constructor._WARNING('screenshot(name, data)');
    return false;
  }

  /**
   * 分片截图
   */
  async screenshots(name, data = {}) {
    this.constructor._WARNING('screenshots(name, data)');
    return false;
  }

  /**
   * 该渲染后端是否可导入
   */
  static isImportable() {
    return false;
  }

  static _WARNING(fName) {
    logger.fatal('方法 "' + fName + ' 在类 ' + this.name + ' 中未被实现，请报告错误！');
  }
}

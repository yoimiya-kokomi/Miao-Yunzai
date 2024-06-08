mys 存在循环引用

(!) Circular dependencies
src/mys/apiTool.ts -> src/mys/mysApi.ts -> src/mys/apiTool.ts
src/mys/gsCfg.ts -> src/mys/mysInfo.ts -> src/mys/gsCfg.ts
src/mys/NoteUser.ts -> src/mys/MysUser.ts -> src/mys/NoteUser.ts

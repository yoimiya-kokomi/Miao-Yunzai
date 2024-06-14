export { Common, Data } from '#miao'
export { Character, Weapon } from '#miao.models'
// import lodash from 'lodash'
// import { existsSync, mkdirSync } from 'node:fs'
// import util from 'node:util'

// const rootPath = process.cwd()
// const _path = rootPath

// const getRoot = (root = '') => {
//     if (!root) {
//         root = `${_path}/`
//     } else if (root === 'root' || root === 'yunzai') {
//         root = `${_path}/`
//     } else if (root === 'miao') {
//         root = `${_path}/plugins/miao-plugin/`
//     } else {
//         root = `${_path}/plugins/${root}/`
//     }
//     return root
// }

// export const Data = {
//     //
//     createDir(path = '', root = '', includeFile = false) {
//         root = getRoot(root)
//         let pathList = path.split('/')
//         let nowPath = root
//         pathList.forEach((name, idx) => {
//             name = name.trim()
//             if (!includeFile && idx <= pathList.length - 1) {
//                 nowPath += name + '/'
//                 if (name) {
//                     if (!existsSync(nowPath)) {
//                         mkdirSync(nowPath)
//                     }
//                 }
//             }
//         })
//     },
//     isPromise(data) {
//         return util.types.isPromise(data)
//     },
//     async forEach(data, fn) {
//         if (lodash.isArray(data)) {
//             for (let idx = 0; idx < data.length; idx++) {
//                 let ret = fn(data[idx], idx)
//                 ret = Data.isPromise(ret) ? await ret : ret
//                 if (ret === false) {
//                     break
//                 }
//             }
//         } else if (lodash.isPlainObject(data)) {
//             for (const idx in data) {
//                 let ret = fn(data[idx], idx)
//                 ret = Data.isPromise(ret) ? await ret : ret
//                 if (ret === false) {
//                     break
//                 }
//             }
//         }
//     }
// }

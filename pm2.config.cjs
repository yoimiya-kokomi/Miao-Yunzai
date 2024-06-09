const argv = [...process.argv].slice(4)
module.exports = {
  apps: [
    {
      name: 'Miao-Yunzai',
      script: './index.js',
      args: argv,
      max_memory_restart: '512M',
      restart_delay: 60000
    }
  ]
}

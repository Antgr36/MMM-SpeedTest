/*
 * Module: MMM-SpeedTest
 * 
 * @bugsounet
 */

var NodeHelper = require('node_helper');
var _loadLib = require("./components/loadLibraries.js") // <-- main code for loading libraries

let log = (...args) => { /* do nothing */ }

module.exports = NodeHelper.create({
  start: function(){
    this.lib = { error: 0 }
    this.config = null
    this.interval = null
  },

  socketNotificationReceived: function(notification, payload){
    if (notification == "INIT") this.initialize(payload)
  },

  initialize: async function(payload) {
    console.log("[SPEED] MMM-SpeedTest Version:", require('./package.json').version)
    this.config= payload
    this.config.update= this.getUpdateTime(this.config.update)
    if (this.config.debug) log = (...args) => { console.log("[SPEED]", ...args) }
    await _loadLib.load(this) // <-- try to load sensible library (speedtest-net)
    if (this.lib.error) return // <-- verify if no errors // if error stop module !
    this.check() // <--- execute speed check
  },

  check: async function() {
    log("[SPEED] Check SpeedTest")
    try {
      var Check = await this.lib.speedtest({
        "serverId": this.config.server.preferedId ? this.config.server.preferedId : null,
        "acceptLicense": this.config.server.acceptLicense,
        "acceptGdpr": this.config.server.acceptGdpr,
        "progress": (data) => this.progress(data)
      })
    } catch (err) {
      console.log("[SPEED]", err.message)
    } finally {
      if (Check) {
        log("Result:", Check)
        this.sendSocketNotification("DATA", Check)
        log("Done")
      }
    }
    this.scheduleUpdate()
  },

  progress: function(data) {
    switch (data.type) {
      case "download":
        this.sendSocketNotification("DOWNLOAD", this.oToMbps(data.download.bandwidth))
        log("Download:", this.oToMbps(data.download.bandwidth), "Mbps")
        break
      case "upload":
        this.sendSocketNotification("UPLOAD", this.oToMbps(data.upload.bandwidth))
        log("Upload:", this.oToMbps(data.upload.bandwidth), "Mbps")
        break
      case "ping":
        this.sendSocketNotification("PING", data.ping.latency)
        log("Ping:", data.ping.latency, "ms")
        break
    }
  },

  /** update process **/
  scheduleUpdate: function() {
    if (this.config.update < 60*1000) this.config.update = 60*1000
    clearInterval(this.interval)
    log("Update Programmed")
    this.interval = setInterval(() => {
      log("Update...")
      this.check()
    }, this.config.update)
  },

  /** convert h m s to ms **/
  getUpdateTime: function(str) {
    let ms = 0, time, type, value
    let time_list = ('' + str).split(' ').filter(v => v != '' && /^(\d{1,}\.)?\d{1,}([wdhms])?$/i.test(v))

    for(let i = 0, len = time_list.length; i < len; i++){
      time = time_list[i]
      type = time.match(/[wdhms]$/i)

      if(type){
        value = Number(time.replace(type[0], ''))

        switch(type[0].toLowerCase()){
          case 'w':
            ms += value * 604800000
            break
          case 'd':
            ms += value * 86400000
            break
          case 'h':
            ms += value * 3600000
            break
          case 'm':
            ms += value * 60000
            break
          case 's':
            ms += value * 1000
          break
        }
      } else if(!isNaN(parseFloat(time)) && isFinite(time)){
        ms += parseFloat(time)
      }
    }
    return ms
  },

  /** Convert octect to Mbps [Match with Speedtest web result] **/
  oToMbps: function(value) {
    if (!value) return 0
    return (value * 0.000008).toFixed(2)
  }
});


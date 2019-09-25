const fs = require('fs'),
    path = require('path'),
	Ping = require('./ping.js')

module.exports = function BossPingRemover(mod) {
    // constants
    const ping = Ping(mod),
		config = require('./config.json')

    // variables
    let zone,
        data,
        cache = {},
        currentActions = {},
        writing = false

    // get data
    try {
        data = require('./data.json')
    }
    catch (err) {
        data = {}
    }

    // write cache on disconnect
    this.destructor = () => {
        writeCache(cache)
    }
    
    // async write for performance
    function writeCache(cache) {
        clean(cache)
        if (Object.keys(cache).length != 0) {
            Object.assign(data, cache)
            // if being written, don't retry
            if (!writing) {
                writing = true
                fs.writeFile(path.join(__dirname, 'data.json'), JSON.stringify(data, null, '\t'), (err) => {
                    writing = false
                    if (err) return
                })
            }
        }
    }

    // initialize keys and subkeys to avoid "undefined object" errors
    function checkCache(huntingZoneId, templateId) {
        // if not cached, try to read from data
        if (!cache[huntingZoneId]) {
            if (data[huntingZoneId]) cache[huntingZoneId] = data[huntingZoneId]
            else cache[huntingZoneId] = {}
        }
        if (!cache[huntingZoneId][templateId]) cache[huntingZoneId][templateId] = {}
    }

    // delete empty objects inside an object
    function clean(obj) {
        for (let key in obj) {
            if (obj[key] && typeof obj[key] === "object") {
                if (Object.keys(obj[key]).length !== 0) {
                    clean(obj[key])
                }
                if (Object.keys(obj[key]).length === 0) {
                    delete obj[key]
                }
            }
        }
    }

    // S_SPAWN_NPC
    mod.hook('S_SPAWN_NPC', 11, {order: 200, filter: {fake: null}}, event => {
        checkCache(event.huntingZoneId, event.templateId)
    })

    // S_LOAD_TOPO
    mod.hook('S_LOAD_TOPO', 3, event => {
		if (zone && zone != event.zone) {
            writeCache(cache)
            cache = {}
        }
        zone = event.zone
        currentActions = {}
    })

    // S_ACTION_STAGE
    mod.hook('S_ACTION_STAGE', 9, {order: 2000}, event => {
        if (event.skill.npc) {
            let huntingZoneId = event.skill.huntingZoneId,
                templateId = event.templateId,
                skill = event.skill.id
            checkCache(huntingZoneId, templateId)
            // if multi stage, do not update start time
            if (currentActions[event.id] && event.stage > currentActions[event.id].stage) {
                currentActions[event.id] = {
                    time: currentActions[event.id].time,
                    speed: event.speed,
                    stage: event.stage
                }
            }
            else {
                currentActions[event.id] = {
                    time: Date.now(),
                    speed: event.speed,
                    stage: event.stage
                }
            }
            let length = cache[huntingZoneId][templateId][skill]
            if (length > 0 && ping.history.length > 0) {
                // shorten by ping
                event.speed = event.speed * (length * config.speedMultiplier) / Math.max(length - ping.avg * event.speed, 1000/config.minCombatFPS)
                return true
            }
        }
    })

    // S_ACTION_END
    mod.hook('S_ACTION_END', 5, event => {
        if (event.skill.npc) {
            let huntingZoneId = event.skill.huntingZoneId,
                templateId = event.templateId,
                skill = event.skill.id
            if (currentActions[event.id]) {
                let time = (Date.now() - currentActions[event.id].time) / currentActions[event.id].speed
                delete currentActions[event.id]
                if (event.type == 0) {
                    checkCache(huntingZoneId, templateId)
                    cache[huntingZoneId][templateId][skill] = Math.round(cache[huntingZoneId][templateId][skill] ? (cache[huntingZoneId][templateId][skill] + time) / 2 : time)
                }
            }
        }
    })
}
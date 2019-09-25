'use strict'

const PING_HISTORY_MAX = 20

class Ping {
  constructor(dispatch) {
    this.min = this.max = this.avg = 0
    this.history = []
  
    const updatePing = ping => {
      this.history.push(ping)
      if(this.history.length > PING_HISTORY_MAX) this.history.shift()
      
      this.min = this.max = this.history[0]
      this.avg = 0

      for(let p of this.history) {
        if(p < this.min) this.min = p
        else if(p > this.max) this.max = p
        
        this.avg += p
      }

      this.avg /= this.history.length
    }

    //---
    
    let gameId
    this.last = 0
    let pingStack = {}

    const pingStart = id => {
      if(!id) return
      pingStack[id] = Date.now()
    }
    const pingEnd = id => {
      if(!pingStack[id]) return
	  if(Date.now() - pingStack[id] < 30) return
      this.last = Date.now() - pingStack[id]
      updatePing(this.last)
      delete pingStack[id]
    }

    const skillId = id => {
      return ((id > 0x4000000) ? id - 0x4000000 : id)
    }
    
    dispatch.hook('S_LOGIN', 13, e => {gameId = e.gameId})

    const skillHook = e => {
        if (e.skill) pingStart(e.skill.id ? e.skill.id : skillId(e.skill))
    }

    for(let packet of [
      ['C_START_SKILL', 7],
    ]) dispatch.hook(packet[0], packet[1], { /*filter: { fake: false, modified: false },*/ order: 1000 }, skillHook)

    dispatch.hook('C_CANCEL_SKILL', 3, e => {
        if (e.skill) delete pingStack[e.skill.id ? e.skill.id : skillId(e.skill)]
    })

    const actionHook = e => {
      if(e.gameId && e.gameId != gameId) return
	  if(e.skill) pingEnd(e.skill.id ? e.skill.id : skillId(e.skill))
    }

    for(let packet of [
      ['S_ACTION_STAGE', 9],
    ]) dispatch.hook(packet[0], packet[1], { filter: { fake: false, modified: false, silenced: null }, order: -1000 }, actionHook)
    
  }
}

let map = new WeakMap()
module.exports = function Require(dispatch) {
  if(map.has(dispatch)) return map.get(dispatch)

  let ping = new Ping(dispatch)
  map.set(dispatch, ping)
  return ping
}
// Set this to your lowest ping -- If you don't have ping-remover
const MY_MIN_PING = 60;
// Setting this above 1.0 will make the boss faster, or under for slower
const SPECIAL_LENGTH_MULTIPLIER = 1.0;

const Command = require('command');

try{
	var Ping = require('ping');
}catch(e){}

class PingClass{
	constructor(){
		function getPing(){
			return MY_MIN_PING;
		}
		this.getPing = getPing;
	}
}

class BossPingRemover{
	constructor(dispatch){
		try{
			this.ping = Ping(dispatch);
		}catch(e){
			this.ping = new PingClass();
		}
		this.zone = -1;
		this.enabled = true;
		this.command = Command(dispatch);
		
		this.command.add('bpr', ()=>{
			this.enabled = !this.enabled;
			this.command.message("Boss ping remover has been " + (this.enabled?"enabled.":"disabled."));
		});
		
		dispatch.hook('S_LOAD_TOPO', 1, e=>{
			if(e.zone != this.zone){
				this.cache = {};
			}
			this.mobsInArea = {};
			this.zone = e.zone;
		});
		
		dispatch.hook('S_SPAWN_NPC', 4, e=>{
			if(this.cache[e.huntingZoneId] === undefined){
				try{
					this.cache[e.huntingZoneId] = require('./bosses/' + e.huntingZoneId.toString() + ".json");
				}catch(e){}
			}
			if(this.cache[e.huntingZoneId] !== undefined){
				this.mobsInArea[e.id.toString()] = {
					"id": e.templateId.toString(),
					"zone": e.huntingZoneId,
				};
			}
		});
		
		dispatch.hook('S_LOGIN', 9, e=>{
			this.gameId = e.gameId;
		});
		
		dispatch.hook('S_DESPAWN_NPC', 1, e=>{
			var source = e.target.toString();
			if(this.mobsInArea[source] !== undefined){
				delete this.mobsInArea[source];
			}
		});
		
		dispatch.hook('S_ACTION_STAGE', 1, e=>{
			if(!this.enabled || e.skill === undefined || this.gameId.equals(e.source)) return;
			
			var source = e.source.toString();
			if(this.mobsInArea[source] !== undefined){
                let skill = parseInt('0x' + e.skill.toString(16).slice(-4));
				var length = 0;
				for(var obj of e.movement){
					length += obj['duration'];
				}
				if(length == 0){
					try{
						length = this.cache[this.mobsInArea[source]['zone']][this.mobsInArea[source]['id']][skill];
					}catch(e){
						//console.log("[BPR]", this.mobsInArea[source], skill);
						return;
					}
				}
				var newSpeed = ((length * SPECIAL_LENGTH_MULTIPLIER) / (length - this.ping.getPing())) * e.speed;
				if(newSpeed > e.speed)
					e.speed = newSpeed;
				return true;
			}
		});
	}
	
}

module.exports = BossPingRemover;

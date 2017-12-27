// !pe                      -> Turn projectile exploit on and off. 
// !peall                   -> Make projectile exploit target all entities in your render range.
// !shiftpos <units>        -> Shift your vertical position by <units> units. 
//                             Can make you invincible by shifting you into the ground, but you will lose aggro and mobs will reset.
//                             If you're too far out of the level bounds, you might be unable to use skills.
//                             The server might actually send you out of the level bounds if you make it update your client position (i.e. jaunt, lag, etc).
//                             A noclip or warp cheat is recommended to get back in.
// 
// !pes <tick> <iterations> -> Projectile exploit will send at most <iterations> packets every <tick> milliseconds. 
//                             Increase <tick> and/or decrease <iterations> if you're getting kicked from EU.
//                             Default is 50 | 2.
//
// Happy hunting!

const Command = require('command')

module.exports = function ProjectileExploit(dispatch) {
	const command = Command(dispatch)
	
	let enabled = true
	let targetAll = true
	let shiftpos = 0
	let cid = null
	
	let packets = []
	let targets = []
	let timeout = null
	
	let timerTick = 50
	let timerIterations = 2
	let lastJ = 0
	
	let curX = 0
	let curY = 0
	let curZ = 0
	
	command.add('pe', () => {
		enabled = !enabled
		command.message('Projectile exploit module '+(enabled?'enabled':'disabled')+'.')
	})
	
	command.add('peall', () => {
		targetAll = !targetAll
		command.message('Targeting all '+(targetAll?'enabled':'disabled')+'.')
	})
	
	command.add('shiftpos', (offset) => {
		shiftpos = parseFloat(offset)
		command.message('ShiftPos set to '+(shiftpos)+'.')
	})
	
	command.add('pes', (newTick, newIterations) => {
		timerTick = parseInt(newTick)
		timerIterations = parseInt(newIterations)
		enabled = true
		command.message(`Now repeating every ${timerTick} ms, ${timerIterations} times`)
	})
	
	dispatch.hook('S_LOGIN', 2, (event) => {
		cid = event.cid
	})
	
	dispatch.hook('C_PLAYER_LOCATION', (event) => {
		curX = event.x1;
		curY = event.y1;
		curZ = event.z1;
		if (shiftpos === 0) return
		event.z1 += shiftpos
		event.z2 += shiftpos
		return true
	})
	
	dispatch.hook('S_ACTION_STAGE', (event) => {
		if (shiftpos === 0) return
		if (event.source.toString() !== cid.toString()) return
		event.x = curX
		event.y = curY
		event.z = curZ
		return true
	})
	
	dispatch.hook('S_ACTION_END', (event) => {
		if (shiftpos === 0) return
		if (event.source.toString() !== cid.toString()) return
		event.x = curX
		event.y = curY
		event.z = curZ
		return true
	})
	
	dispatch.hook('S_SPAWN_NPC', (event) => {
		targets.push(event.id)
		//console.log('NPC found: ' + event.id)
	})
	
	dispatch.hook('S_DESPAWN_NPC', (event) => {
		//console.log('NPC despawned: ' + event.target)
		for (let i = 0; i < targets.length; i++) {
			if (targets[i].toString() === event.target.toString()) {
				//console.log('NPC deleted: ' + event.target)
				targets.splice(i, 1)
				i--;
			}
		}
	})
	
	function runTimer()
	{
		let i = 0
		let j = lastJ
		if (j >= packets.length) j = 0
		
		while (i < timerIterations) {
			//console.log(`Sending packet to dispatch: ${JSON.stringify(packets[j], null, 4)}`)
			dispatch.toServer('C_HIT_USER_PROJECTILE', packets[j])
			i++
			j++
			if (j >= packets.length) j = 0
		}
		
		lastJ = j
		
		if (timeout !== null) {
			timeout = setTimeout(() => {
				runTimer()
			}, timerTick)
		}
	}
	
	function addPacket(event)
	{
		packets.push(event)
		if (timeout === null) {
			timeout = setTimeout(() => {
				runTimer()
			}, timerTick)
		}
	}
	
	function clearProjectile(projectileId)
	{
		for (let i = 0; i < packets.length; i++) {
			if (packets[i].source.toString() === projectileId.toString()) {
				packets.splice(i, 1)
				i--;
			}
		}
		
		if (packets.length === 0) {
			if (timeout !== null) {
				clearTimeout(timeout)
				timeout = null
			}
		}
	}
	
	dispatch.hook('S_START_USER_PROJECTILE', (event) => {
		if (!enabled) return
		if (!targetAll) return
		
		if (event.source.toString() !== cid.toString()) return
		
		for (let tgt of targets) {
			console.log(`Attacking: ${tgt}`)
			let packet = {
				source: event.id,
				end: 0,
				x: event.x1,
				y: event.y1,
				z: event.z1,
				targets: [
					{
						target: tgt,
						unk1: 0
					}
				]
			}
			
			console.log(`Adding npc to proj queue: ${JSON.stringify(packet, null, 4)}`)
			addPacket(packet)
		}
	})
	
	dispatch.hook('C_HIT_USER_PROJECTILE', (event) => {
		if (event.end !== 0) {
			clearProjectile(event.source)
			return
		}
		
		if (!enabled) return
		
		addPacket(event)
		
		return false
		
	})
	
	dispatch.hook('S_END_USER_PROJECTILE', (event) => {
		clearProjectile(event.id)
	})
}

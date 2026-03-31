// src/game/engine/SpringJoint.ts

export interface SpringJointConfig {
	stiffness: number;   // higher = slower spring (divisor for force)
	damping: number;     // 0..1, velocity retention per tick
	limit: number;       // max deflection in radians
}

export class SpringJoint {
	public angle = 0;             // current offset from rest position (radians)
	public angularVelocity = 0;   // rad/s

	private stiffness: number;
	private damping: number;
	private limit: number;

	constructor(config: SpringJointConfig) {
		this.stiffness = config.stiffness;
		this.damping = config.damping;
		this.limit = config.limit;
	}

	/**
	 * Update spring physics. Call once per frame.
	 * @param dt - delta time in seconds
	 * @param bodyAngularVelocity - parent body's angular velocity (rad/s).
	 *   Limb inertia resists body rotation, creating swing.
	 */
	update(dt: number, bodyAngularVelocity: number): void {
		// Spring force pulls joint back to rest (angle = 0)
		const springForce = -this.angle / this.stiffness;

		// Inertia: body rotation pushes joint in opposite direction
		const inertiaForce = -bodyAngularVelocity * dt * 30; // scaled to feel right

		this.angularVelocity += (springForce + inertiaForce);
		this.angularVelocity *= this.damping;
		this.angle += this.angularVelocity * dt;

		// Clamp to joint limits
		if (this.angle > this.limit) {
			this.angle = this.limit;
			this.angularVelocity = 0;
		} else if (this.angle < -this.limit) {
			this.angle = -this.limit;
			this.angularVelocity = 0;
		}
	}

	/** Apply a sudden impulse (e.g. on landing impact) */
	impulse(force: number): void {
		this.angularVelocity += force;
	}

	/** Reset to rest position */
	reset(): void {
		this.angle = 0;
		this.angularVelocity = 0;
	}
}
